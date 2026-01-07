# Orders Migration Plan

The legacy codebase stored order-like data across multiple tables (e.g., `active_trackings`, `empty_packages`, `design_orders`).
To consolidate these into the new `orders` table, run the following high-level steps in a maintenance window:

1. **Create the `orders` table** using the current TypeORM schema (or a generated migration).
2. **Backfill data**:
   - Insert from each legacy table with a `CASE` expression to map to the new `order_type`, `order_status`, and `payment_status` enums.
   - Normalize monetary fields into `total_cost` and copy any tracking/label references into `tracking_code`, `label_url`, or `label_image_url`.
3. **Validate counts** by comparing per-user totals between old and new structures.
4. **Switch application traffic** to the new endpoints, keeping legacy tables read-only.
5. **Retire legacy tables** once monitoring confirms parity.

For local/dev environments, enable `DB_SYNC=true` (default) so the new table is generated automatically.
For production, generate an explicit TypeORM migration and execute it alongside the data backfill SQL scripts described above.
