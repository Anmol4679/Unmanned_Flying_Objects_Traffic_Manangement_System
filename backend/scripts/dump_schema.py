#!/usr/bin/env python3
"""
dump_schema.py - Database Schema Inspector & Mermaid ERD Generator
Inspects the live PostgreSQL database using SQLAlchemy and outputs:
1. Detailed table schema (columns, types, PKs, FKs, UNIQUE, and CHECK constraints) to stdout.
2. Mermaid ER diagram to docs/erd.mmd covering all currently instantiated tables.

Aborts with an error if executed against SQLite.
Tables owned by teammates not yet migrated (e.g., waypoint_telemetry) are noted as pending.
"""

import sys
from pathlib import Path
from sqlalchemy import inspect

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from database import engine

def main():
    dialect_name = engine.dialect.name.lower()
    if "sqlite" in dialect_name:
        sys.stderr.write("ERROR: SQLite connection detected. dump_schema.py requires the live PostgreSQL database (utm_drone_db).\n")
        sys.exit(1)

    print(f"============================================================")
    print(f"DATABASE SCHEMA DUMP (Target: PostgreSQL / {engine.url.render_as_string(hide_password=True)})")
    print(f"============================================================\n")

    insp = inspect(engine)
    all_tables = insp.get_table_names()
    tables = [t for t in all_tables if t != "alembic_version"]

    mermaid_lines = [
        "erDiagram",
        "    %% Live Database Schema from utm_drone_db",
        "    %% Generated via backend/scripts/dump_schema.py",
        "    %% NOTE: Pending teammate tables (e.g., waypoint_telemetry) are omitted until instantiated.\n"
    ]

    relationships = []

    for table in tables:
        pk_info = insp.get_pk_constraint(table)
        pk_cols = set(pk_info.get("constrained_columns") or [])

        fks = insp.get_foreign_keys(table)
        fk_map = {}
        for fk in fks:
            referred_tbl = fk.get("referred_table")
            for local_col, ref_col in zip(fk.get("constrained_columns", []), fk.get("referred_columns", [])):
                fk_map[local_col] = (referred_tbl, ref_col, fk.get("options", {}).get("ondelete", "NO ACTION"))

        uniques = insp.get_unique_constraints(table)
        unique_cols = set()
        for uq in uniques:
            for c in uq.get("column_names") or []:
                unique_cols.add(c)

        checks = insp.get_check_constraints(table)
        columns = insp.get_columns(table)

        print(f"TABLE: {table}")
        print(f"  Primary Key: {list(pk_cols)}")
        print("  Columns:")
        for col in columns:
            c_name = col["name"]
            c_type = str(col["type"])
            nullable = "NULL" if col.get("nullable") else "NOT NULL"
            flags = []
            if c_name in pk_cols:
                flags.append("PK")
            if c_name in fk_map:
                ref_t, ref_c, on_del = fk_map[c_name]
                flags.append(f"FK -> {ref_t}({ref_c}) ON DELETE {on_del}")
            if c_name in unique_cols:
                flags.append("UNIQUE")
            flags_str = f" [{', '.join(flags)}]" if flags else ""
            print(f"    - {c_name}: {c_type} {nullable}{flags_str}")

        if fks:
            print("  Foreign Key Constraints:")
            for fk in fks:
                print(f"    - {fk.get('name')}: {fk.get('constrained_columns')} -> {fk.get('referred_table')}{fk.get('referred_columns')} ON DELETE {fk.get('options', {}).get('ondelete')}")

        if uniques:
            print("  Unique Constraints:")
            for uq in uniques:
                print(f"    - {uq.get('name')}: {uq.get('column_names')}")

        if checks:
            print("  Check Constraints:")
            for chk in checks:
                print(f"    - {chk.get('name')}: {chk.get('sqltext')}")

        print("-" * 60)

        # Mermaid table representation
        mermaid_lines.append(f"    {table.upper()} {{")
        for col in columns:
            c_name = col["name"]
            # Clean type for mermaid
            raw_type = str(col["type"]).lower()
            if "int" in raw_type:
                m_type = "int"
            elif "numeric" in raw_type or "float" in raw_type:
                m_type = "float"
            elif "bool" in raw_type:
                m_type = "boolean"
            elif "timestamp" in raw_type:
                m_type = "timestamp"
            else:
                m_type = "string"

            marker = ""
            if c_name in pk_cols and c_name in fk_map:
                marker = "PK,FK"
            elif c_name in pk_cols:
                marker = "PK"
            elif c_name in fk_map:
                marker = "FK"
            elif c_name in unique_cols:
                marker = "UK"

            marker_str = f" {marker}" if marker else ""
            mermaid_lines.append(f"        {m_type} {c_name}{marker_str}")
        mermaid_lines.append("    }\n")

        # Collect relationships
        for fk in fks:
            ref_tbl = fk.get("referred_table").upper()
            curr_tbl = table.upper()
            on_del = fk.get("options", {}).get("ondelete", "")
            # Check if 1:1 (subtype or unique FK) or 1:N
            is_subtype = (table.startswith("drone_") and "drone_id" in pk_cols)
            if is_subtype:
                rel = f'    {ref_tbl} ||--o| {curr_tbl} : "specializes ({on_del})"'
            elif "slot_id" in fk.get("constrained_columns", []) and table == "reservation":
                rel = f'    {ref_tbl} ||--o| {curr_tbl} : "books ({on_del})"'
            else:
                rel = f'    {ref_tbl} ||--o{{ {curr_tbl} : "has ({on_del})"'
            relationships.append(rel)

    mermaid_lines.extend(sorted(set(relationships)))

    # Pending teammate tables documentation comment
    mermaid_lines.append("\n    %% PENDING TEAMMATE TABLES (Not yet created in PostgreSQL):")
    mermaid_lines.append("    %% - waypoint_telemetry (Teammate Shlok - Telemetry / Redis+InfluxDB / Timeseries)")

    erd_content = "\n".join(mermaid_lines) + "\n"

    # Save to docs/erd.mmd
    repo_root = backend_dir.parent
    docs_dir = repo_root / "docs"
    docs_dir.mkdir(exist_ok=True)
    erd_file = docs_dir / "erd.mmd"
    erd_file.write_text(erd_content, encoding="utf-8")
    print(f"\n[OK] Mermaid ER diagram successfully generated at {erd_file}")

if __name__ == "__main__":
    main()
