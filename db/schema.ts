import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const products = sqliteTable('products', { id: text('id').primaryKey(), data: text('data').notNull() });
export const profiles = sqliteTable('profiles', { id: text('id').primaryKey(), data: text('data').notNull() });
export const carts = sqliteTable('carts', { id: text('id').primaryKey(), data: text('data').notNull() });
export const orders = sqliteTable('orders', { id: text('id').primaryKey(), userId: text('user_id').notNull(), data: text('data').notNull(), createdAt: integer('created_at').notNull() });
