/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex) {
  // Ensure pgcrypto is available for gen_random_uuid()
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  return knex.schema.createTable("tariff_snapshots", (table) => {
    // use UUID primary key for flexibility
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.date("day").notNullable().unique();
    table.jsonb("data").notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
    table.timestamp("updated_at").defaultTo(knex.fn.now()).notNullable();
  });
}

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex) {
  return knex.schema.dropTable("tariff_snapshots");
}
