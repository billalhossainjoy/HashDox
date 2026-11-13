import { integer, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
// Core Better Auth SQLite models. Run Better Auth's schema checker after install.
export const user = sqliteTable('user', {
 id: text('id').primaryKey(), name: text('name').notNull(),
 email: text('email').notNull().unique(),
 emailVerified: integer('email_verified', {mode:'boolean'}).notNull().default(false),
 image: text('image'),
 createdAt: integer('created_at', {mode:'timestamp_ms'}).notNull(),
 updatedAt: integer('updated_at', {mode:'timestamp_ms'}).notNull(),
});
export const session = sqliteTable('session', {
 id: text('id').primaryKey(),
 expiresAt: integer('expires_at', {mode:'timestamp_ms'}).notNull(),
 token: text('token').notNull().unique(),
 createdAt: integer('created_at', {mode:'timestamp_ms'}).notNull(),
 updatedAt: integer('updated_at', {mode:'timestamp_ms'}).notNull(),
 ipAddress: text('ip_address'), userAgent: text('user_agent'),
 userId: text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
}, t=>[index('session_user_idx').on(t.userId)]);
export const account = sqliteTable('account', {
 id: text('id').primaryKey(), accountId: text('account_id').notNull(),
 providerId: text('provider_id').notNull(),
 userId: text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
 accessToken: text('access_token'), refreshToken: text('refresh_token'),
 idToken: text('id_token'),
 accessTokenExpiresAt: integer('access_token_expires_at',{mode:'timestamp_ms'}),
 refreshTokenExpiresAt: integer('refresh_token_expires_at',{mode:'timestamp_ms'}),
 scope: text('scope'), password: text('password'),
 createdAt: integer('created_at',{mode:'timestamp_ms'}).notNull(),
 updatedAt: integer('updated_at',{mode:'timestamp_ms'}).notNull(),
}, t=>[index('account_user_idx').on(t.userId),uniqueIndex('account_provider_unique').on(t.providerId,t.accountId)]);
export const verification = sqliteTable('verification', {
 id:text('id').primaryKey(), identifier:text('identifier').notNull(),
 value:text('value').notNull(),
 expiresAt:integer('expires_at',{mode:'timestamp_ms'}).notNull(),
 createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),
 updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull(),
},t=>[index('verification_identifier_idx').on(t.identifier)]);

/** Owner-managed projects; secrets and environments will be modeled separately. */
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('projects_created_at_idx').on(table.createdAt)]);

/** Environment belongs to exactly one project; slugs remain stable after renaming. */
export const environments = sqliteTable('environments', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('environments_project_slug_unique').on(table.projectId, table.slug),
  index('environments_project_id_idx').on(table.projectId),
]);
