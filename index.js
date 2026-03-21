// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/oauth.ts
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

// server/db.ts
import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  totalPoints: int("totalPoints").default(0).notNull(),
  level: int("level").default(1).notNull(),
  selectedCharacterId: int("selectedCharacterId"),
  geminiApiKey: text("geminiApiKey"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var characters = mysqlTable("characters", {
  id: int("id").autoincrement().primaryKey(),
  nameAr: varchar("nameAr", { length: 100 }).notNull(),
  nameEn: varchar("nameEn", { length: 100 }).notNull(),
  descriptionAr: text("descriptionAr").notNull(),
  descriptionEn: text("descriptionEn"),
  icon: varchar("icon", { length: 50 }).notNull(),
  color: varchar("color", { length: 20 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  specialAbilityAr: text("specialAbilityAr"),
  specialAbilityEn: text("specialAbilityEn"),
  systemPrompt: text("systemPrompt"),
  personality: text("personality"),
  expertise: varchar("expertise", { length: 200 }),
  price: int("price").default(0).notNull(),
  isPremium: boolean("isPremium").default(false).notNull(),
  greeting: text("greeting"),
  imageUrl: text("imageUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var userCharacters = mysqlTable("user_characters", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  characterId: int("characterId").notNull(),
  xp: int("xp").default(0).notNull(),
  level: int("level").default(1).notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  unlockedAt: timestamp("unlockedAt").defaultNow().notNull()
});
var tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  titleAr: varchar("titleAr", { length: 200 }).notNull(),
  titleEn: varchar("titleEn", { length: 200 }),
  descriptionAr: text("descriptionAr").notNull(),
  descriptionEn: text("descriptionEn"),
  category: varchar("category", { length: 50 }).notNull(),
  points: int("points").default(10).notNull(),
  xpReward: int("xpReward").default(5).notNull(),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).default("easy").notNull(),
  characterId: int("characterId"),
  isDaily: boolean("isDaily").default(false).notNull(),
  icon: varchar("icon", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var taskCompletions = mysqlTable("task_completions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  taskId: int("taskId").notNull(),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
  pointsEarned: int("pointsEarned").default(0).notNull(),
  xpEarned: int("xpEarned").default(0).notNull()
});
var articles = mysqlTable("articles", {
  id: int("id").autoincrement().primaryKey(),
  titleAr: varchar("titleAr", { length: 300 }).notNull(),
  titleEn: varchar("titleEn", { length: 300 }),
  contentAr: text("contentAr").notNull(),
  contentEn: text("contentEn"),
  category: varchar("category", { length: 50 }).notNull(),
  imageUrl: text("imageUrl"),
  authorId: int("authorId"),
  readTime: int("readTime").default(5),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var forumPosts = mysqlTable("forum_posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  titleAr: varchar("titleAr", { length: 300 }).notNull(),
  contentAr: text("contentAr").notNull(),
  category: varchar("category", { length: 50 }).default("general").notNull(),
  likesCount: int("likesCount").default(0).notNull(),
  commentsCount: int("commentsCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var forumComments = mysqlTable("forum_comments", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userId: int("userId").notNull(),
  contentAr: text("contentAr").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var forumLikes = mysqlTable("forum_likes", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  titleAr: varchar("titleAr", { length: 300 }).notNull(),
  contentAr: text("contentAr"),
  type: varchar("type", { length: 50 }).default("info").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var courses = mysqlTable("courses", {
  id: int("id").autoincrement().primaryKey(),
  titleAr: varchar("titleAr", { length: 300 }).notNull(),
  titleEn: varchar("titleEn", { length: 300 }).notNull(),
  descriptionAr: text("descriptionAr").notNull(),
  descriptionEn: text("descriptionEn"),
  category: varchar("category", { length: 50 }).notNull(),
  level: mysqlEnum("courseLevel", ["beginner", "intermediate", "advanced"]).default("beginner").notNull(),
  courseType: mysqlEnum("courseType", ["certificate", "diploma"]).default("certificate").notNull(),
  provider: varchar("provider", { length: 100 }).default("Alison").notNull(),
  externalUrl: text("externalUrl").notNull(),
  imageUrl: text("imageUrl"),
  duration: varchar("duration", { length: 50 }),
  learnersCount: int("learnersCount").default(0),
  pointsReward: int("pointsReward").default(50).notNull(),
  isFeatured: boolean("isFeatured").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var userCourseProgress = mysqlTable("user_course_progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  courseId: int("courseId").notNull(),
  status: mysqlEnum("progressStatus", ["enrolled", "in_progress", "completed"]).default("enrolled").notNull(),
  enrolledAt: timestamp("enrolledAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  pointsEarned: int("pointsEarned").default(0).notNull()
});
var achievements = mysqlTable("achievements", {
  id: int("id").autoincrement().primaryKey(),
  nameAr: varchar("nameAr", { length: 200 }).notNull(),
  nameEn: varchar("nameEn", { length: 200 }).notNull(),
  descriptionAr: text("descriptionAr").notNull(),
  descriptionEn: text("descriptionEn"),
  icon: varchar("icon", { length: 50 }).notNull(),
  color: varchar("color", { length: 30 }).notNull(),
  category: mysqlEnum("achievementCategory", ["tasks", "courses", "community", "streak", "special"]).notNull(),
  tier: mysqlEnum("achievementTier", ["bronze", "silver", "gold", "platinum", "diamond"]).default("bronze").notNull(),
  conditionType: varchar("conditionType", { length: 50 }).notNull(),
  conditionValue: int("conditionValue").default(1).notNull(),
  pointsReward: int("pointsReward").default(25).notNull(),
  isSecret: boolean("isSecret").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var userAchievements = mysqlTable("user_achievements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  achievementId: int("achievementId").notNull(),
  earnedAt: timestamp("earnedAt").defaultNow().notNull(),
  pointsEarned: int("pointsEarned").default(0).notNull()
});
var weeklyChallenges = mysqlTable("weekly_challenges", {
  id: int("id").autoincrement().primaryKey(),
  titleAr: varchar("titleAr", { length: 300 }).notNull(),
  descriptionAr: text("descriptionAr").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  targetCount: int("targetCount").default(5).notNull(),
  pointsReward: int("pointsReward").default(100).notNull(),
  icon: varchar("icon", { length: 50 }).default("trophy").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var challengeParticipants = mysqlTable("challenge_participants", {
  id: int("id").autoincrement().primaryKey(),
  challengeId: int("challengeId").notNull(),
  userId: int("userId").notNull(),
  progress: int("progress").default(0).notNull(),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  pointsEarned: int("pointsEarned").default(0).notNull()
});
var investmentProjects = mysqlTable("investment_projects", {
  id: int("id").autoincrement().primaryKey(),
  titleAr: varchar("titleAr", { length: 300 }).notNull(),
  titleEn: varchar("titleEn", { length: 300 }).notNull(),
  descriptionAr: text("descriptionAr").notNull(),
  descriptionEn: text("descriptionEn"),
  category: mysqlEnum("investCategory", ["self_sufficiency", "smart_tech", "eco_entertainment", "development", "energy", "water"]).notNull(),
  difficulty: mysqlEnum("investDifficulty", ["beginner", "intermediate", "advanced"]).default("beginner").notNull(),
  estimatedCostMin: int("estimatedCostMin").default(0),
  estimatedCostMax: int("estimatedCostMax").default(0),
  currency: varchar("currency", { length: 10 }).default("SAR"),
  returnType: mysqlEnum("returnType", ["financial", "savings", "self_sufficiency", "environmental", "mixed"]).default("mixed").notNull(),
  estimatedReturnAr: text("estimatedReturnAr"),
  estimatedReturnEn: text("estimatedReturnEn"),
  timeframeAr: varchar("timeframeAr", { length: 200 }),
  timeframeEn: varchar("timeframeEn", { length: 200 }),
  stepsAr: json("stepsAr").$type(),
  stepsEn: json("stepsEn").$type(),
  benefitsAr: json("benefitsAr").$type(),
  benefitsEn: json("benefitsEn").$type(),
  toolsAr: json("toolsAr").$type(),
  toolsEn: json("toolsEn").$type(),
  tipsAr: json("tipsAr").$type(),
  tipsEn: json("tipsEn").$type(),
  icon: varchar("icon", { length: 50 }).default("leaf"),
  color: varchar("color", { length: 20 }).default("#22c55e"),
  imageUrl: text("imageUrl"),
  isFeatured: boolean("isFeatured").default(false).notNull(),
  pointsReward: int("pointsReward").default(30).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var userInvestmentBookmarks = mysqlTable("user_investment_bookmarks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId").notNull(),
  status: mysqlEnum("bookmarkStatus", ["interested", "planning", "in_progress", "completed"]).default("interested").notNull(),
  notes: text("notes"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  pointsEarned: int("pointsEarned").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var investmentApplications = mysqlTable("investment_applications", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId"),
  fullName: varchar("fullName", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  city: varchar("city", { length: 100 }),
  budget: varchar("budget", { length: 100 }),
  messageAr: text("messageAr"),
  experienceLevel: mysqlEnum("experienceLevel", ["none", "beginner", "intermediate", "expert"]).default("none").notNull(),
  status: mysqlEnum("applicationStatus", ["pending", "reviewing", "approved", "rejected", "contacted"]).default("pending").notNull(),
  adminNotes: text("adminNotes"),
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: int("reviewedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var paymentGateways = mysqlTable("payment_gateways", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  // paypal, bank_transfer, tap, manual
  nameAr: varchar("nameAr", { length: 200 }).notNull(),
  nameEn: varchar("nameEn", { length: 200 }).notNull(),
  descriptionAr: text("descriptionAr"),
  descriptionEn: text("descriptionEn"),
  icon: varchar("icon", { length: 50 }).default("credit-card"),
  color: varchar("color", { length: 20 }).default("#3b82f6"),
  isActive: boolean("isActive").default(true).notNull(),
  requiresApproval: boolean("requiresApproval").default(false).notNull(),
  // manual/bank need admin approval
  configJson: json("configJson").$type(),
  // gateway-specific config (account details, etc)
  instructionsAr: text("instructionsAr"),
  // instructions shown to user
  instructionsEn: text("instructionsEn"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var paymentOrders = mysqlTable("payment_orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 50 }).notNull().unique(),
  userId: int("userId"),
  applicationId: int("applicationId"),
  // links to investment application
  gatewayId: int("gatewayId").notNull(),
  gatewayCode: varchar("gatewayCode", { length: 50 }).notNull(),
  amount: int("amount").notNull(),
  // amount in smallest unit (halalas/cents)
  currency: varchar("currency", { length: 10 }).default("SAR").notNull(),
  status: mysqlEnum("paymentStatus", ["pending", "processing", "completed", "failed", "cancelled", "refunded"]).default("pending").notNull(),
  descriptionAr: text("descriptionAr"),
  descriptionEn: text("descriptionEn"),
  payerName: varchar("payerName", { length: 200 }),
  payerEmail: varchar("payerEmail", { length: 320 }),
  payerPhone: varchar("payerPhone", { length: 50 }),
  // Gateway-specific data
  externalId: varchar("externalId", { length: 200 }),
  // PayPal/Tap transaction ID
  proofUrl: text("proofUrl"),
  // receipt/transfer proof image URL
  proofNotes: text("proofNotes"),
  // user notes about the payment
  // Admin fields
  adminNotes: text("adminNotes"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("chatRole", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  characterId: int("characterId"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var characterSubscriptions = mysqlTable("character_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  characterId: int("characterId").notNull(),
  status: mysqlEnum("status", ["active", "expired", "cancelled"]).default("active").notNull(),
  paymentOrderId: int("paymentOrderId"),
  subscribedAt: timestamp("subscribedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt")
});
var characterMemory = mysqlTable("character_memory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  characterId: int("characterId").notNull(),
  memoryType: mysqlEnum("memType", ["fact", "preference", "goal", "context", "personality_note"]).default("fact").notNull(),
  memoryKey: varchar("memoryKey", { length: 200 }).notNull(),
  memoryValue: text("memoryValue").notNull(),
  importance: int("importance").default(5).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var conversationSummaries = mysqlTable("conversation_summaries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  characterId: int("characterId").notNull(),
  summary: text("summary").notNull(),
  topicsDiscussed: text("topicsDiscussed"),
  userMood: varchar("userMood", { length: 50 }),
  keyInsights: text("keyInsights"),
  messageCount: int("messageCount").default(0).notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var pointPurchases = mysqlTable("point_purchases", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  points: int("points").notNull(),
  amountSAR: int("amountSAR").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }).default("pending"),
  paymentReference: varchar("paymentReference", { length: 200 }),
  status: mysqlEnum("purchaseStatus", ["pending", "completed", "failed", "refunded"]).default("pending").notNull(),
  adminNotes: text("adminNotes"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var pointInvestments = mysqlTable("point_investments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId").notNull(),
  pointsInvested: int("pointsInvested").notNull(),
  status: mysqlEnum("status", ["active", "completed", "withdrawn", "cancelled"]).default("active").notNull(),
  returnPoints: int("returnPoints").default(0).notNull(),
  notes: text("notes"),
  investedAt: timestamp("investedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var pointTransactions = mysqlTable("point_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("txType", ["earn_task", "earn_course", "earn_achievement", "earn_challenge", "earn_investment_return", "purchase", "invest", "withdraw", "refund", "admin_grant"]).notNull(),
  points: int("points").notNull(),
  balanceBefore: int("balanceBefore").default(0).notNull(),
  balanceAfter: int("balanceAfter").default(0).notNull(),
  referenceId: int("referenceId"),
  referenceType: varchar("referenceType", { length: 50 }),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = { openId: user.openId };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod", "passwordHash"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = /* @__PURE__ */ new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getUserByEmail(email) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getAllCharacters() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(characters);
}
async function getCharacterById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(characters).where(eq(characters.id, id)).limit(1);
  return result[0];
}
async function getUserCharacters(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: userCharacters.id,
    characterId: userCharacters.characterId,
    xp: userCharacters.xp,
    level: userCharacters.level,
    isActive: userCharacters.isActive,
    unlockedAt: userCharacters.unlockedAt,
    nameAr: characters.nameAr,
    nameEn: characters.nameEn,
    icon: characters.icon,
    color: characters.color,
    category: characters.category,
    descriptionAr: characters.descriptionAr,
    specialAbilityAr: characters.specialAbilityAr
  }).from(userCharacters).innerJoin(characters, eq(userCharacters.characterId, characters.id)).where(eq(userCharacters.userId, userId));
}
async function selectCharacter(userId, characterId) {
  const db = await getDb();
  if (!db) return;
  await db.update(userCharacters).set({ isActive: false }).where(eq(userCharacters.userId, userId));
  const existing = await db.select().from(userCharacters).where(and(eq(userCharacters.userId, userId), eq(userCharacters.characterId, characterId))).limit(1);
  if (existing.length > 0) {
    await db.update(userCharacters).set({ isActive: true }).where(and(eq(userCharacters.userId, userId), eq(userCharacters.characterId, characterId)));
  } else {
    await db.insert(userCharacters).values({ userId, characterId, isActive: true });
  }
  await db.update(users).set({ selectedCharacterId: characterId }).where(eq(users.id, userId));
}
async function getAllTasks() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks);
}
async function getDailyTasks() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks).where(eq(tasks.isDaily, true));
}
async function getTasksByCategory(category) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks).where(eq(tasks.category, category));
}
async function completeTask(userId, taskId) {
  const db = await getDb();
  if (!db) return null;
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task[0]) return null;
  const t2 = task[0];
  await db.insert(taskCompletions).values({
    userId,
    taskId,
    pointsEarned: t2.points,
    xpEarned: t2.xpReward
  });
  await db.update(users).set({
    totalPoints: sql`totalPoints + ${t2.points}`,
    level: sql`GREATEST(1, FLOOR((totalPoints + ${t2.points}) / 100) + 1)`
  }).where(eq(users.id, userId));
  if (t2.characterId) {
    const uc = await db.select().from(userCharacters).where(and(eq(userCharacters.userId, userId), eq(userCharacters.characterId, t2.characterId))).limit(1);
    if (uc[0]) {
      const newXp = uc[0].xp + t2.xpReward;
      const newLevel = Math.floor(newXp / 100) + 1;
      await db.update(userCharacters).set({ xp: newXp, level: newLevel }).where(eq(userCharacters.id, uc[0].id));
    }
  }
  return { points: t2.points, xp: t2.xpReward };
}
async function getUserCompletions(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: taskCompletions.id,
    taskId: taskCompletions.taskId,
    completedAt: taskCompletions.completedAt,
    pointsEarned: taskCompletions.pointsEarned,
    xpEarned: taskCompletions.xpEarned,
    taskTitle: tasks.titleAr,
    taskCategory: tasks.category
  }).from(taskCompletions).innerJoin(tasks, eq(taskCompletions.taskId, tasks.id)).where(eq(taskCompletions.userId, userId)).orderBy(desc(taskCompletions.completedAt));
}
async function getAllArticles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(articles).orderBy(desc(articles.createdAt));
}
async function getArticleById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  return result[0];
}
async function getArticlesByCategory(category) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(articles).where(eq(articles.category, category)).orderBy(desc(articles.createdAt));
}
async function getForumPosts(category) {
  const db = await getDb();
  if (!db) return [];
  const baseQuery = db.select({
    id: forumPosts.id,
    titleAr: forumPosts.titleAr,
    contentAr: forumPosts.contentAr,
    category: forumPosts.category,
    likesCount: forumPosts.likesCount,
    commentsCount: forumPosts.commentsCount,
    createdAt: forumPosts.createdAt,
    userId: forumPosts.userId,
    userName: users.name
  }).from(forumPosts).innerJoin(users, eq(forumPosts.userId, users.id)).orderBy(desc(forumPosts.createdAt));
  if (category && category !== "all") {
    return baseQuery.where(eq(forumPosts.category, category));
  }
  return baseQuery;
}
async function createForumPost(userId, titleAr, contentAr, category) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(forumPosts).values({ userId, titleAr, contentAr, category });
  return { id: result[0].insertId };
}
async function getPostComments(postId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: forumComments.id,
    contentAr: forumComments.contentAr,
    createdAt: forumComments.createdAt,
    userId: forumComments.userId,
    userName: users.name
  }).from(forumComments).innerJoin(users, eq(forumComments.userId, users.id)).where(eq(forumComments.postId, postId)).orderBy(desc(forumComments.createdAt));
}
async function addComment(postId, userId, contentAr) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(forumComments).values({ postId, userId, contentAr });
  await db.update(forumPosts).set({ commentsCount: sql`commentsCount + 1` }).where(eq(forumPosts.id, postId));
  return true;
}
async function toggleLike(postId, userId) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select().from(forumLikes).where(and(eq(forumLikes.postId, postId), eq(forumLikes.userId, userId))).limit(1);
  if (existing.length > 0) {
    await db.delete(forumLikes).where(eq(forumLikes.id, existing[0].id));
    await db.update(forumPosts).set({ likesCount: sql`GREATEST(likesCount - 1, 0)` }).where(eq(forumPosts.id, postId));
    return false;
  } else {
    await db.insert(forumLikes).values({ postId, userId });
    await db.update(forumPosts).set({ likesCount: sql`likesCount + 1` }).where(eq(forumPosts.id, postId));
    return true;
  }
}
async function getUserLikes(userId) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ postId: forumLikes.postId }).from(forumLikes).where(eq(forumLikes.userId, userId));
  return result.map((r) => r.postId);
}
async function getUserNotifications(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(50);
}
async function createNotification(userId, titleAr, contentAr, type) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values({ userId, titleAr, contentAr, type });
}
async function markNotificationRead(id, userId) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}
async function markAllNotificationsRead(userId) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}
async function getUnreadCount(userId) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql`count(*)` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result[0]?.count ?? 0;
}
async function saveChatMessage(userId, role, content, characterId) {
  const db = await getDb();
  if (!db) return;
  await db.insert(chatMessages).values({ userId, role, content, characterId });
}
async function getChatHistory(userId, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages).where(eq(chatMessages.userId, userId)).orderBy(desc(chatMessages.createdAt)).limit(limit);
}
async function getLeaderboard(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    name: users.name,
    totalPoints: users.totalPoints,
    level: users.level
  }).from(users).orderBy(desc(users.totalPoints)).limit(limit);
}
async function getAllCourses() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(courses).orderBy(desc(courses.isFeatured));
}
async function getFeaturedCourses() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(courses).where(eq(courses.isFeatured, true));
}
async function getCourseById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
  return result[0];
}
async function getCoursesByCategory(category) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(courses).where(eq(courses.category, category));
}
async function enrollInCourse(userId, courseId) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(userCourseProgress).where(and(eq(userCourseProgress.userId, userId), eq(userCourseProgress.courseId, courseId))).limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(userCourseProgress).values({ userId, courseId, status: "enrolled" });
  const course = await getCourseById(courseId);
  if (course) {
    await createNotification(userId, "\u062A\u0645 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 \u0641\u064A \u0643\u0648\u0631\u0633 \u062C\u062F\u064A\u062F", `\u062A\u0645 \u062A\u0633\u062C\u064A\u0644\u0643 \u0641\u064A \u0643\u0648\u0631\u0633 "${course.titleAr}" \u0628\u0646\u062C\u0627\u062D. \u0627\u0628\u062F\u0623 \u0627\u0644\u062A\u0639\u0644\u0645 \u0627\u0644\u0622\u0646!`, "course");
  }
  return { userId, courseId, status: "enrolled" };
}
async function updateCourseProgress(userId, courseId, status) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(userCourseProgress).where(and(eq(userCourseProgress.userId, userId), eq(userCourseProgress.courseId, courseId))).limit(1);
  if (!existing[0]) return null;
  const updateData = { status };
  if (status === "completed") {
    updateData.completedAt = /* @__PURE__ */ new Date();
    const course = await getCourseById(courseId);
    if (course) {
      updateData.pointsEarned = course.pointsReward;
      await db.update(users).set({
        totalPoints: sql`totalPoints + ${course.pointsReward}`,
        level: sql`GREATEST(1, FLOOR((totalPoints + ${course.pointsReward}) / 100) + 1)`
      }).where(eq(users.id, userId));
      await createNotification(userId, "\u062A\u0647\u0627\u0646\u064A\u0646\u0627! \u0623\u0643\u0645\u0644\u062A \u0643\u0648\u0631\u0633\u0627\u064B", `\u0623\u0643\u0645\u0644\u062A \u0643\u0648\u0631\u0633 "${course.titleAr}" \u0648\u062D\u0635\u0644\u062A \u0639\u0644\u0649 ${course.pointsReward} \u0646\u0642\u0637\u0629!`, "achievement");
    }
  }
  await db.update(userCourseProgress).set(updateData).where(and(eq(userCourseProgress.userId, userId), eq(userCourseProgress.courseId, courseId)));
  return { status };
}
async function getUserCourseProgressList(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: userCourseProgress.id,
    courseId: userCourseProgress.courseId,
    status: userCourseProgress.status,
    enrolledAt: userCourseProgress.enrolledAt,
    completedAt: userCourseProgress.completedAt,
    pointsEarned: userCourseProgress.pointsEarned,
    courseTitleAr: courses.titleAr,
    courseCategory: courses.category,
    courseLevel: courses.level,
    courseProvider: courses.provider,
    courseType: courses.courseType
  }).from(userCourseProgress).innerJoin(courses, eq(userCourseProgress.courseId, courses.id)).where(eq(userCourseProgress.userId, userId)).orderBy(desc(userCourseProgress.enrolledAt));
}
async function getAllAchievements() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(achievements).orderBy(achievements.sortOrder);
}
async function getUserAchievementsList(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: userAchievements.id,
    achievementId: userAchievements.achievementId,
    earnedAt: userAchievements.earnedAt,
    pointsEarned: userAchievements.pointsEarned,
    nameAr: achievements.nameAr,
    nameEn: achievements.nameEn,
    descriptionAr: achievements.descriptionAr,
    icon: achievements.icon,
    color: achievements.color,
    category: achievements.category,
    tier: achievements.tier
  }).from(userAchievements).innerJoin(achievements, eq(userAchievements.achievementId, achievements.id)).where(eq(userAchievements.userId, userId)).orderBy(desc(userAchievements.earnedAt));
}
async function checkAndGrantAchievements(userId) {
  const db = await getDb();
  if (!db) return [];
  const allAch = await db.select().from(achievements);
  const earned = await db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
  const earnedIds = new Set(earned.map((e) => e.achievementId));
  const tasksCount = await db.select({ count: sql`count(*)` }).from(taskCompletions).where(eq(taskCompletions.userId, userId));
  const coursesEnrolled = await db.select({ count: sql`count(*)` }).from(userCourseProgress).where(eq(userCourseProgress.userId, userId));
  const coursesCompleted = await db.select({ count: sql`count(*)` }).from(userCourseProgress).where(and(eq(userCourseProgress.userId, userId), eq(userCourseProgress.status, "completed")));
  const postsCount = await db.select({ count: sql`count(*)` }).from(forumPosts).where(eq(forumPosts.userId, userId));
  const charsCount = await db.select({ count: sql`count(*)` }).from(userCharacters).where(eq(userCharacters.userId, userId));
  const chatCount = await db.select({ count: sql`count(*)` }).from(chatMessages).where(and(eq(chatMessages.userId, userId), eq(chatMessages.role, "user")));
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const totalPoints = user[0]?.totalPoints ?? 0;
  const userPostIds = await db.select({ id: forumPosts.id }).from(forumPosts).where(eq(forumPosts.userId, userId));
  let totalLikesReceived = 0;
  if (userPostIds.length > 0) {
    const likesResult = await db.select({ total: sql`COALESCE(SUM(likesCount), 0)` }).from(forumPosts).where(eq(forumPosts.userId, userId));
    totalLikesReceived = likesResult[0]?.total ?? 0;
  }
  const hasSelectedChar = user[0]?.selectedCharacterId ? 1 : 0;
  const conditionMap = {
    tasks_completed: tasksCount[0]?.count ?? 0,
    courses_enrolled: coursesEnrolled[0]?.count ?? 0,
    courses_completed: coursesCompleted[0]?.count ?? 0,
    posts_created: postsCount[0]?.count ?? 0,
    likes_received: totalLikesReceived,
    characters_unlocked: charsCount[0]?.count ?? 0,
    character_selected: hasSelectedChar,
    chat_messages: chatCount[0]?.count ?? 0,
    total_points: totalPoints,
    daily_streak: 0
    // Streak logic would need separate tracking
  };
  const newlyEarned = [];
  for (const ach of allAch) {
    if (earnedIds.has(ach.id)) continue;
    const currentValue = conditionMap[ach.conditionType] ?? 0;
    if (currentValue >= ach.conditionValue) {
      await db.insert(userAchievements).values({
        userId,
        achievementId: ach.id,
        pointsEarned: ach.pointsReward
      });
      await db.update(users).set({
        totalPoints: sql`totalPoints + ${ach.pointsReward}`,
        level: sql`GREATEST(1, FLOOR((totalPoints + ${ach.pointsReward}) / 100) + 1)`
      }).where(eq(users.id, userId));
      await createNotification(
        userId,
        `\u0625\u0646\u062C\u0627\u0632 \u062C\u062F\u064A\u062F: ${ach.nameAr}`,
        `\u062A\u0647\u0627\u0646\u064A\u0646\u0627! \u062D\u0635\u0644\u062A \u0639\u0644\u0649 \u0634\u0627\u0631\u0629 "${ach.nameAr}" \u0648\u0631\u0628\u062D\u062A ${ach.pointsReward} \u0646\u0642\u0637\u0629 \u0625\u0636\u0627\u0641\u064A\u0629!`,
        "achievement"
      );
      newlyEarned.push({
        id: ach.id,
        nameAr: ach.nameAr,
        tier: ach.tier,
        pointsReward: ach.pointsReward,
        icon: ach.icon,
        color: ach.color
      });
    }
  }
  return newlyEarned;
}
async function getUserStats(userId) {
  const db = await getDb();
  if (!db) return null;
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]) return null;
  const completionsCount = await db.select({ count: sql`count(*)` }).from(taskCompletions).where(eq(taskCompletions.userId, userId));
  const charsCount = await db.select({ count: sql`count(*)` }).from(userCharacters).where(eq(userCharacters.userId, userId));
  const postsCount = await db.select({ count: sql`count(*)` }).from(forumPosts).where(eq(forumPosts.userId, userId));
  return {
    totalPoints: user[0].totalPoints,
    level: user[0].level,
    tasksCompleted: completionsCount[0]?.count ?? 0,
    charactersUnlocked: charsCount[0]?.count ?? 0,
    forumPosts: postsCount[0]?.count ?? 0
  };
}
async function getActiveChallenges() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(weeklyChallenges).where(eq(weeklyChallenges.isActive, true)).orderBy(desc(weeklyChallenges.startDate));
}
async function getChallengeById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(weeklyChallenges).where(eq(weeklyChallenges.id, id)).limit(1);
  return result[0];
}
async function joinChallenge(userId, challengeId) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(challengeParticipants).where(and(eq(challengeParticipants.userId, userId), eq(challengeParticipants.challengeId, challengeId))).limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(challengeParticipants).values({ userId, challengeId });
  const challenge = await getChallengeById(challengeId);
  if (challenge) {
    await createNotification(userId, "\u0627\u0646\u0636\u0645\u0645\u062A \u0644\u062A\u062D\u062F\u064D\u0651 \u062C\u062F\u064A\u062F!", `\u0627\u0646\u0636\u0645\u0645\u062A \u0644\u062A\u062D\u062F\u064A "${challenge.titleAr}". \u062D\u0638\u0627\u064B \u0645\u0648\u0641\u0642\u0627\u064B!`, "challenge");
  }
  return { userId, challengeId, progress: 0, isCompleted: false };
}
async function updateChallengeProgress(userId, challengeId, increment = 1) {
  const db = await getDb();
  if (!db) return null;
  const participant = await db.select().from(challengeParticipants).where(and(eq(challengeParticipants.userId, userId), eq(challengeParticipants.challengeId, challengeId))).limit(1);
  if (!participant[0] || participant[0].isCompleted) return null;
  const challenge = await getChallengeById(challengeId);
  if (!challenge) return null;
  const newProgress = Math.min(participant[0].progress + increment, challenge.targetCount);
  const isCompleted = newProgress >= challenge.targetCount;
  const updateData = { progress: newProgress };
  if (isCompleted) {
    updateData.isCompleted = true;
    updateData.completedAt = /* @__PURE__ */ new Date();
    updateData.pointsEarned = challenge.pointsReward;
    await db.update(users).set({ totalPoints: sql`totalPoints + ${challenge.pointsReward}`, level: sql`GREATEST(1, FLOOR((totalPoints + ${challenge.pointsReward}) / 100) + 1)` }).where(eq(users.id, userId));
    await createNotification(userId, "\u0623\u0643\u0645\u0644\u062A \u0627\u0644\u062A\u062D\u062F\u064A!", `\u062A\u0647\u0627\u0646\u064A\u0646\u0627! \u0623\u0643\u0645\u0644\u062A \u062A\u062D\u062F\u064A "${challenge.titleAr}" \u0648\u062D\u0635\u0644\u062A \u0639\u0644\u0649 ${challenge.pointsReward} \u0646\u0642\u0637\u0629!`, "achievement");
  }
  await db.update(challengeParticipants).set(updateData).where(and(eq(challengeParticipants.userId, userId), eq(challengeParticipants.challengeId, challengeId)));
  return { progress: newProgress, isCompleted };
}
async function getUserChallenges(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: challengeParticipants.id,
    challengeId: challengeParticipants.challengeId,
    progress: challengeParticipants.progress,
    isCompleted: challengeParticipants.isCompleted,
    joinedAt: challengeParticipants.joinedAt,
    completedAt: challengeParticipants.completedAt,
    pointsEarned: challengeParticipants.pointsEarned,
    titleAr: weeklyChallenges.titleAr,
    descriptionAr: weeklyChallenges.descriptionAr,
    category: weeklyChallenges.category,
    targetCount: weeklyChallenges.targetCount,
    challengePoints: weeklyChallenges.pointsReward,
    icon: weeklyChallenges.icon,
    startDate: weeklyChallenges.startDate,
    endDate: weeklyChallenges.endDate
  }).from(challengeParticipants).innerJoin(weeklyChallenges, eq(challengeParticipants.challengeId, weeklyChallenges.id)).where(eq(challengeParticipants.userId, userId)).orderBy(desc(challengeParticipants.joinedAt));
}
async function getChallengeLeaderboard(challengeId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    userId: challengeParticipants.userId,
    progress: challengeParticipants.progress,
    isCompleted: challengeParticipants.isCompleted,
    userName: users.name
  }).from(challengeParticipants).innerJoin(users, eq(challengeParticipants.userId, users.id)).where(eq(challengeParticipants.challengeId, challengeId)).orderBy(desc(challengeParticipants.progress)).limit(20);
}
async function adminCreateTask(data) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(tasks).values(data);
  return { id: result[0].insertId };
}
async function adminUpdateTask(id, data) {
  const db = await getDb();
  if (!db) return null;
  await db.update(tasks).set(data).where(eq(tasks.id, id));
  return { success: true };
}
async function adminDeleteTask(id) {
  const db = await getDb();
  if (!db) return null;
  await db.delete(taskCompletions).where(eq(taskCompletions.taskId, id));
  await db.delete(tasks).where(eq(tasks.id, id));
  return { success: true };
}
async function adminCreateArticle(data) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(articles).values(data);
  return { id: result[0].insertId };
}
async function adminUpdateArticle(id, data) {
  const db = await getDb();
  if (!db) return null;
  await db.update(articles).set(data).where(eq(articles.id, id));
  return { success: true };
}
async function adminDeleteArticle(id) {
  const db = await getDb();
  if (!db) return null;
  await db.delete(articles).where(eq(articles.id, id));
  return { success: true };
}
async function adminCreateCourse(data) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(courses).values(data);
  return { id: result[0].insertId };
}
async function adminUpdateCourse(id, data) {
  const db = await getDb();
  if (!db) return null;
  await db.update(courses).set(data).where(eq(courses.id, id));
  return { success: true };
}
async function adminDeleteCourse(id) {
  const db = await getDb();
  if (!db) return null;
  await db.delete(userCourseProgress).where(eq(userCourseProgress.courseId, id));
  await db.delete(courses).where(eq(courses.id, id));
  return { success: true };
}
async function getAdminStats() {
  const db = await getDb();
  if (!db) return null;
  const usersCount = await db.select({ count: sql`count(*)` }).from(users);
  const tasksCount = await db.select({ count: sql`count(*)` }).from(tasks);
  const articlesCount = await db.select({ count: sql`count(*)` }).from(articles);
  const coursesCount = await db.select({ count: sql`count(*)` }).from(courses);
  const postsCount = await db.select({ count: sql`count(*)` }).from(forumPosts);
  const completionsCount = await db.select({ count: sql`count(*)` }).from(taskCompletions);
  const enrollmentsCount = await db.select({ count: sql`count(*)` }).from(userCourseProgress);
  return {
    totalUsers: usersCount[0]?.count ?? 0,
    totalTasks: tasksCount[0]?.count ?? 0,
    totalArticles: articlesCount[0]?.count ?? 0,
    totalCourses: coursesCount[0]?.count ?? 0,
    totalPosts: postsCount[0]?.count ?? 0,
    totalCompletions: completionsCount[0]?.count ?? 0,
    totalEnrollments: enrollmentsCount[0]?.count ?? 0
  };
}
async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    totalPoints: users.totalPoints,
    level: users.level,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn
  }).from(users).orderBy(desc(users.createdAt));
}
async function getAllInvestmentProjects() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(investmentProjects).orderBy(investmentProjects.sortOrder, investmentProjects.createdAt);
}
async function getInvestmentProjectsByCategory(category) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(investmentProjects).where(eq(investmentProjects.category, category)).orderBy(investmentProjects.sortOrder);
}
async function getFeaturedInvestmentProjects() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(investmentProjects).where(eq(investmentProjects.isFeatured, true)).orderBy(investmentProjects.sortOrder);
}
async function getInvestmentProjectById(id) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(investmentProjects).where(eq(investmentProjects.id, id));
  return rows[0] || null;
}
async function bookmarkInvestmentProject(userId, projectId) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(userInvestmentBookmarks).where(and(eq(userInvestmentBookmarks.userId, userId), eq(userInvestmentBookmarks.projectId, projectId)));
  if (existing.length > 0) return existing[0];
  await db.insert(userInvestmentBookmarks).values({ userId, projectId, status: "interested" });
  const rows = await db.select().from(userInvestmentBookmarks).where(and(eq(userInvestmentBookmarks.userId, userId), eq(userInvestmentBookmarks.projectId, projectId)));
  return rows[0] || null;
}
async function updateInvestmentBookmarkStatus(userId, projectId, status) {
  const db = await getDb();
  if (!db) return null;
  const updateData = { status };
  if (status === "in_progress") updateData.startedAt = /* @__PURE__ */ new Date();
  if (status === "completed") {
    updateData.completedAt = /* @__PURE__ */ new Date();
    const project = await getInvestmentProjectById(projectId);
    if (project) {
      updateData.pointsEarned = project.pointsReward;
      await db.update(users).set({ totalPoints: sql`totalPoints + ${project.pointsReward}`, level: sql`GREATEST(1, FLOOR((totalPoints + ${project.pointsReward}) / 100) + 1)` }).where(eq(users.id, userId));
    }
  }
  await db.update(userInvestmentBookmarks).set(updateData).where(and(eq(userInvestmentBookmarks.userId, userId), eq(userInvestmentBookmarks.projectId, projectId)));
  return { success: true };
}
async function removeInvestmentBookmark(userId, projectId) {
  const db = await getDb();
  if (!db) return null;
  await db.delete(userInvestmentBookmarks).where(and(eq(userInvestmentBookmarks.userId, userId), eq(userInvestmentBookmarks.projectId, projectId)));
  return { success: true };
}
async function getUserInvestmentBookmarks(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userInvestmentBookmarks).where(eq(userInvestmentBookmarks.userId, userId)).orderBy(desc(userInvestmentBookmarks.createdAt));
}
async function adminCreateInvestmentProject(data) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(investmentProjects).values(data);
  return { success: true };
}
async function adminUpdateInvestmentProject(id, data) {
  const db = await getDb();
  if (!db) return null;
  await db.update(investmentProjects).set(data).where(eq(investmentProjects.id, id));
  return { success: true };
}
async function adminDeleteInvestmentProject(id) {
  const db = await getDb();
  if (!db) return null;
  await db.delete(userInvestmentBookmarks).where(eq(userInvestmentBookmarks.projectId, id));
  await db.delete(investmentProjects).where(eq(investmentProjects.id, id));
  return { success: true };
}
async function createInvestmentApplication(data) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(investmentApplications).values({
    ...data,
    userId: data.userId ?? void 0
  });
  return { id: result[0].insertId };
}
async function getAllInvestmentApplications() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(investmentApplications).orderBy(desc(investmentApplications.createdAt));
}
async function getInvestmentApplicationsByStatus(status) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(investmentApplications).where(eq(investmentApplications.status, status)).orderBy(desc(investmentApplications.createdAt));
}
async function getUserInvestmentApplications(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(investmentApplications).where(eq(investmentApplications.userId, userId)).orderBy(desc(investmentApplications.createdAt));
}
async function getInvestmentApplicationById(id) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(investmentApplications).where(eq(investmentApplications.id, id));
  return rows[0] || null;
}
async function updateInvestmentApplicationStatus(id, status, adminNotes, reviewedBy) {
  const db = await getDb();
  if (!db) return null;
  await db.update(investmentApplications).set({
    status,
    adminNotes: adminNotes || void 0,
    reviewedBy: reviewedBy || void 0,
    reviewedAt: /* @__PURE__ */ new Date()
  }).where(eq(investmentApplications.id, id));
  return { success: true };
}
async function deleteInvestmentApplication(id) {
  const db = await getDb();
  if (!db) return null;
  await db.delete(investmentApplications).where(eq(investmentApplications.id, id));
  return { success: true };
}
async function getInvestmentApplicationsCount() {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0 };
  const all = await db.select({ count: sql`count(*)` }).from(investmentApplications);
  const pending = await db.select({ count: sql`count(*)` }).from(investmentApplications).where(eq(investmentApplications.status, "pending"));
  return { total: all[0]?.count || 0, pending: pending[0]?.count || 0 };
}
async function getActivePaymentGateways() {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(paymentGateways).where(eq(paymentGateways.isActive, true)).orderBy(paymentGateways.sortOrder);
}
async function getAllPaymentGateways() {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(paymentGateways).orderBy(paymentGateways.sortOrder);
}
async function updatePaymentGateway(id, data) {
  const database = await getDb();
  if (!database) return { success: false };
  await database.update(paymentGateways).set(data).where(eq(paymentGateways.id, id));
  return { success: true };
}
async function createPaymentOrder(data) {
  const database = await getDb();
  if (!database) return { id: 0 };
  const result = await database.insert(paymentOrders).values(data);
  return { id: result[0].insertId };
}
async function getPaymentOrderById(id) {
  const database = await getDb();
  if (!database) return null;
  const rows = await database.select().from(paymentOrders).where(eq(paymentOrders.id, id));
  return rows[0] || null;
}
async function getPaymentOrderByNumber(orderNumber) {
  const database = await getDb();
  if (!database) return null;
  const rows = await database.select().from(paymentOrders).where(eq(paymentOrders.orderNumber, orderNumber));
  return rows[0] || null;
}
async function getUserPaymentOrders(userId) {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(paymentOrders).where(eq(paymentOrders.userId, userId)).orderBy(desc(paymentOrders.createdAt));
}
async function getAllPaymentOrders(status) {
  const database = await getDb();
  if (!database) return [];
  if (status && status !== "all") {
    return database.select().from(paymentOrders).where(eq(paymentOrders.status, status)).orderBy(desc(paymentOrders.createdAt));
  }
  return database.select().from(paymentOrders).orderBy(desc(paymentOrders.createdAt));
}
async function updatePaymentOrderStatus(id, data) {
  const database = await getDb();
  if (!database) return { success: false };
  await database.update(paymentOrders).set(data).where(eq(paymentOrders.id, id));
  return { success: true };
}
async function getPaymentOrdersCount() {
  const database = await getDb();
  if (!database) return { total: 0, pending: 0, completed: 0, totalAmount: 0 };
  const allOrders = await database.select().from(paymentOrders);
  const pending = allOrders.filter((o) => o.status === "pending").length;
  const completed = allOrders.filter((o) => o.status === "completed").length;
  const totalAmount = allOrders.filter((o) => o.status === "completed").reduce((sum, o) => sum + o.amount, 0);
  return { total: allOrders.length, pending, completed, totalAmount };
}
async function deletePaymentOrder(id) {
  const database = await getDb();
  if (!database) return { success: false };
  await database.delete(paymentOrders).where(eq(paymentOrders.id, id));
  return { success: true };
}
async function getCharacterSubscription(userId, characterId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(characterSubscriptions).where(and(
    eq(characterSubscriptions.userId, userId),
    eq(characterSubscriptions.characterId, characterId),
    eq(characterSubscriptions.status, "active")
  )).limit(1);
  return result[0];
}
async function getUserSubscriptions(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(characterSubscriptions).where(and(
    eq(characterSubscriptions.userId, userId),
    eq(characterSubscriptions.status, "active")
  ));
}
async function createCharacterSubscription(userId, characterId, paymentOrderId) {
  const db = await getDb();
  if (!db) return;
  await db.insert(characterSubscriptions).values({
    userId,
    characterId,
    status: "active",
    paymentOrderId: paymentOrderId || null
  });
}
async function hasCharacterAccess(userId, characterId) {
  const db = await getDb();
  if (!db) return false;
  const char = await db.select().from(characters).where(eq(characters.id, characterId)).limit(1);
  if (!char[0]) return false;
  if (!char[0].isPremium) return true;
  const sub = await getCharacterSubscription(userId, characterId);
  return !!sub;
}
async function getCharacterMemories(userId, characterId, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(characterMemory).where(and(
    eq(characterMemory.userId, userId),
    eq(characterMemory.characterId, characterId)
  )).orderBy(desc(characterMemory.importance)).limit(limit);
}
async function saveCharacterMemory(userId, characterId, memoryType, memoryKey, memoryValue, importance = 5) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(characterMemory).where(and(
    eq(characterMemory.userId, userId),
    eq(characterMemory.characterId, characterId),
    eq(characterMemory.memoryKey, memoryKey)
  )).limit(1);
  if (existing[0]) {
    await db.update(characterMemory).set({ memoryValue, importance }).where(eq(characterMemory.id, existing[0].id));
  } else {
    await db.insert(characterMemory).values({
      userId,
      characterId,
      memoryType,
      memoryKey,
      memoryValue,
      importance
    });
  }
}
async function getAllUserMemoriesAcrossCharacters(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(characterMemory).where(eq(characterMemory.userId, userId)).orderBy(desc(characterMemory.importance)).limit(50);
}
async function getConversationSummaries(userId, characterId, limit = 5) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversationSummaries).where(and(
    eq(conversationSummaries.userId, userId),
    eq(conversationSummaries.characterId, characterId)
  )).orderBy(desc(conversationSummaries.periodEnd)).limit(limit);
}
async function getChatHistoryByCharacter(userId, characterId, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages).where(and(
    eq(chatMessages.userId, userId),
    eq(chatMessages.characterId, characterId)
  )).orderBy(desc(chatMessages.createdAt)).limit(limit);
}
async function getUserApiKey(userId) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({ geminiApiKey: users.geminiApiKey }).from(users).where(eq(users.id, userId)).limit(1);
  return result[0]?.geminiApiKey || null;
}
async function saveUserApiKey(userId, apiKey) {
  const db = await getDb();
  if (!db) return false;
  await db.update(users).set({ geminiApiKey: apiKey }).where(eq(users.id, userId));
  return true;
}
async function recordPointTransaction(data) {
  const db = await getDb();
  if (!db) return null;
  const [user] = await db.select({ totalPoints: users.totalPoints }).from(users).where(eq(users.id, data.userId));
  if (!user) return null;
  const balanceBefore = user.totalPoints;
  const balanceAfter = balanceBefore + data.points;
  await db.update(users).set({ totalPoints: balanceAfter }).where(eq(users.id, data.userId));
  await db.insert(pointTransactions).values({
    userId: data.userId,
    type: data.type,
    points: data.points,
    balanceBefore,
    balanceAfter,
    referenceId: data.referenceId,
    referenceType: data.referenceType,
    description: data.description
  });
  return { balanceBefore, balanceAfter };
}
async function createPointPurchase(data) {
  const db = await getDb();
  if (!db) return null;
  const amountSAR = data.points;
  const [result] = await db.insert(pointPurchases).values({
    userId: data.userId,
    points: data.points,
    amountSAR: data.points,
    paymentMethod: data.paymentMethod || "pending",
    paymentReference: data.paymentReference
  }).$returningId();
  return { id: result.id, points: data.points, amountSAR: data.points };
}
async function approvePointPurchase(purchaseId, adminId) {
  const db = await getDb();
  if (!db) return null;
  const [purchase] = await db.select().from(pointPurchases).where(eq(pointPurchases.id, purchaseId));
  if (!purchase || purchase.status !== "pending") return null;
  await db.update(pointPurchases).set({
    status: "completed",
    reviewedBy: adminId,
    reviewedAt: /* @__PURE__ */ new Date()
  }).where(eq(pointPurchases.id, purchaseId));
  const result = await recordPointTransaction({
    userId: purchase.userId,
    type: "purchase",
    points: purchase.points,
    referenceId: purchaseId,
    referenceType: "point_purchase",
    description: `\u0634\u0631\u0627\u0621 ${purchase.points} \u0646\u0642\u0637\u0629 \u0645\u0642\u0627\u0628\u0644 ${purchase.amountSAR} \u0631\u064A\u0627\u0644`
  });
  return result;
}
async function getUserPointPurchases(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pointPurchases).where(eq(pointPurchases.userId, userId)).orderBy(desc(pointPurchases.createdAt));
}
async function getAllPointPurchases() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pointPurchases).orderBy(desc(pointPurchases.createdAt));
}
async function investPointsInProject(data) {
  const db = await getDb();
  if (!db) return null;
  const [user] = await db.select({ totalPoints: users.totalPoints }).from(users).where(eq(users.id, data.userId));
  if (!user || user.totalPoints < data.points) return { error: "insufficient_points" };
  const [result] = await db.insert(pointInvestments).values({
    userId: data.userId,
    projectId: data.projectId,
    pointsInvested: data.points,
    notes: data.notes
  }).$returningId();
  await recordPointTransaction({
    userId: data.userId,
    type: "invest",
    points: -data.points,
    referenceId: result.id,
    referenceType: "point_investment",
    description: `\u0627\u0633\u062A\u062B\u0645\u0627\u0631 ${data.points} \u0646\u0642\u0637\u0629 \u0641\u064A \u0645\u0634\u0631\u0648\u0639 #${data.projectId}`
  });
  return { id: result.id, pointsInvested: data.points };
}
async function getUserInvestments(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pointInvestments).where(eq(pointInvestments.userId, userId)).orderBy(desc(pointInvestments.createdAt));
}
async function getProjectInvestments(projectId) {
  const db = await getDb();
  if (!db) return { total: 0, investors: 0, investments: [] };
  const investments = await db.select().from(pointInvestments).where(and(eq(pointInvestments.projectId, projectId), eq(pointInvestments.status, "active")));
  const total = investments.reduce((sum, inv) => sum + inv.pointsInvested, 0);
  return { total, investors: investments.length, investments };
}
async function getUserTransactions(userId, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pointTransactions).where(eq(pointTransactions.userId, userId)).orderBy(desc(pointTransactions.createdAt)).limit(limit);
}
async function authenticateAdmin(email, password) {
  const db = await getDb();
  if (!db) return null;
  const [user] = await db.select().from(users).where(and(eq(users.email, email), eq(users.role, "admin")));
  if (!user) return null;
  const bcrypt2 = await import("bcryptjs");
  if (!user.passwordHash) return null;
  const isValid = await bcrypt2.compare(password, user.passwordHash);
  if (!isValid) return null;
  return user;
}
async function ensureAdminUser(email, passwordPlain, name) {
  const db = await getDb();
  if (!db) return null;
  const bcrypt2 = await import("bcryptjs");
  const passwordHash = await bcrypt2.hash(passwordPlain, 10);
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) {
    await db.update(users).set({ role: "admin", passwordHash, name }).where(eq(users.id, existing.id));
    return existing.id;
  } else {
    const openId = `admin_${Date.now()}`;
    const [result] = await db.insert(users).values({
      openId,
      email,
      passwordHash,
      name,
      role: "admin",
      loginMethod: "email"
    }).$returningId();
    return result.id;
  }
}
async function getAllInvestments() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pointInvestments).orderBy(desc(pointInvestments.createdAt));
}
async function rejectPointPurchase(purchaseId, adminId, reason) {
  const db = await getDb();
  if (!db) return null;
  await db.update(pointPurchases).set({
    status: "failed",
    reviewedBy: adminId,
    reviewedAt: /* @__PURE__ */ new Date(),
    adminNotes: reason || "\u0645\u0631\u0641\u0648\u0636"
  }).where(eq(pointPurchases.id, purchaseId));
  return true;
}
async function adminGrantPoints(userId, points, adminId, reason) {
  const db = await getDb();
  if (!db) return null;
  return recordPointTransaction({
    userId,
    type: "admin_grant",
    points,
    referenceId: adminId,
    referenceType: "admin_grant",
    description: reason || `\u0645\u0646\u062D\u0629 ${points} \u0646\u0642\u0637\u0629 \u0645\u0646 \u0627\u0644\u0645\u062F\u064A\u0631`
  });
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// server/_core/oauth.ts
function getSessionSecret() {
  const secret = ENV.cookieSecret || "greenminds-default-secret-change-me";
  return new TextEncoder().encode(secret);
}
async function createSessionToken(openId, name) {
  const secretKey = getSessionSecret();
  return new SignJWT({ openId, appId: ENV.appId || "greenminds", name }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("365d").sign(secretKey);
}
function registerOAuthRoutes(app) {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!email || !password || !name) {
        res.status(400).json({ error: "\u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0629" });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 6 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" });
        return;
      }
      const existingUser = await getUserByEmail(email);
      if (existingUser) {
        res.status(400).json({ error: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644" });
        return;
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      await upsertUser({
        openId,
        name,
        email,
        passwordHash,
        loginMethod: "email",
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await createSessionToken(openId, name);
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Register failed", error);
      res.status(500).json({ error: "\u0641\u0634\u0644 \u0627\u0644\u062A\u0633\u062C\u064A\u0644" });
    }
  });
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0629" });
        return;
      }
      const user = await getUserByEmail(email);
      if (!user || !user.passwordHash) {
        res.status(401).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
        return;
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
        return;
      }
      await upsertUser({ openId: user.openId, lastSignedIn: /* @__PURE__ */ new Date() });
      const sessionToken = await createSessionToken(user.openId, user.name || "");
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "\u0641\u0634\u0644 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644" });
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
import { z as z2 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 32768;
  payload.thinking = {
    "budget_tokens": 128
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/routers.ts
var adminProcedure2 = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN", message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0648\u0635\u0648\u0644" });
  return next({ ctx });
});
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  // ===== Characters =====
  characters: router({
    list: publicProcedure.query(async () => {
      return getAllCharacters();
    }),
    getById: publicProcedure.input(z2.object({ id: z2.number() })).query(async ({ input }) => {
      return getCharacterById(input.id);
    }),
    userCharacters: protectedProcedure.query(async ({ ctx }) => {
      return getUserCharacters(ctx.user.id);
    }),
    select: protectedProcedure.input(z2.object({ characterId: z2.number() })).mutation(async ({ ctx, input }) => {
      await selectCharacter(ctx.user.id, input.characterId);
      await createNotification(ctx.user.id, "\u062A\u0645 \u0627\u062E\u062A\u064A\u0627\u0631 \u0634\u062E\u0635\u064A\u0629 \u062C\u062F\u064A\u062F\u0629", "\u0644\u0642\u062F \u0627\u062E\u062A\u0631\u062A \u0634\u062E\u0635\u064A\u0629 \u0628\u064A\u0626\u064A\u0629 \u062C\u062F\u064A\u062F\u0629. \u0627\u0628\u062F\u0623 \u0628\u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u0645\u0647\u0627\u0645 \u0644\u062A\u0637\u0648\u064A\u0631\u0647\u0627!", "character");
      const newAchievements = await checkAndGrantAchievements(ctx.user.id);
      return { success: true, newAchievements };
    })
  }),
  // ===== Tasks =====
  tasks: router({
    list: publicProcedure.input(z2.object({ category: z2.string().optional() }).optional()).query(async ({ input }) => {
      if (input?.category) return getTasksByCategory(input.category);
      return getAllTasks();
    }),
    daily: publicProcedure.query(async () => {
      return getDailyTasks();
    }),
    complete: protectedProcedure.input(z2.object({ taskId: z2.number() })).mutation(async ({ ctx, input }) => {
      const result = await completeTask(ctx.user.id, input.taskId);
      if (result) {
        await createNotification(ctx.user.id, "\u0645\u0647\u0645\u0629 \u0645\u0643\u062A\u0645\u0644\u0629!", `\u062D\u0635\u0644\u062A \u0639\u0644\u0649 ${result.points} \u0646\u0642\u0637\u0629 \u0648 ${result.xp} \u062E\u0628\u0631\u0629`, "task");
        const newAchievements = await checkAndGrantAchievements(ctx.user.id);
        return { ...result, newAchievements };
      }
      return result;
    }),
    completions: protectedProcedure.query(async ({ ctx }) => {
      return getUserCompletions(ctx.user.id);
    })
  }),
  // ===== Articles =====
  articles: router({
    list: publicProcedure.input(z2.object({ category: z2.string().optional() }).optional()).query(async ({ input }) => {
      if (input?.category) return getArticlesByCategory(input.category);
      return getAllArticles();
    }),
    getById: publicProcedure.input(z2.object({ id: z2.number() })).query(async ({ input }) => {
      return getArticleById(input.id);
    })
  }),
  // ===== Forum =====
  forum: router({
    posts: publicProcedure.input(z2.object({ category: z2.string().optional() }).optional()).query(async ({ input }) => {
      return getForumPosts(input?.category);
    }),
    createPost: protectedProcedure.input(z2.object({
      titleAr: z2.string().min(3),
      contentAr: z2.string().min(10),
      category: z2.string().default("general")
    })).mutation(async ({ ctx, input }) => {
      const result = await createForumPost(ctx.user.id, input.titleAr, input.contentAr, input.category);
      notifyOwner({ title: "\u0645\u0646\u0634\u0648\u0631 \u062C\u062F\u064A\u062F \u0641\u064A \u0627\u0644\u0645\u0646\u062A\u062F\u0649", content: `${ctx.user.name || "\u0645\u0633\u062A\u062E\u062F\u0645"} \u0646\u0634\u0631: ${input.titleAr}` }).catch(() => {
      });
      await checkAndGrantAchievements(ctx.user.id);
      return result;
    }),
    comments: publicProcedure.input(z2.object({ postId: z2.number() })).query(async ({ input }) => {
      return getPostComments(input.postId);
    }),
    addComment: protectedProcedure.input(z2.object({
      postId: z2.number(),
      contentAr: z2.string().min(1)
    })).mutation(async ({ ctx, input }) => {
      return addComment(input.postId, ctx.user.id, input.contentAr);
    }),
    toggleLike: protectedProcedure.input(z2.object({ postId: z2.number() })).mutation(async ({ ctx, input }) => {
      return toggleLike(input.postId, ctx.user.id);
    }),
    userLikes: protectedProcedure.query(async ({ ctx }) => {
      return getUserLikes(ctx.user.id);
    })
  }),
  // ===== Notifications =====
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserNotifications(ctx.user.id);
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return getUnreadCount(ctx.user.id);
    }),
    markRead: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
      await markNotificationRead(input.id, ctx.user.id);
      return { success: true };
    }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await markAllNotificationsRead(ctx.user.id);
      return { success: true };
    })
  }),
  // ===== Chat (Ka-777) =====
  chat: router({
    send: protectedProcedure.input(z2.object({
      message: z2.string().min(1),
      characterId: z2.number()
    })).mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const charId = input.characterId;
      const char = await getCharacterById(charId);
      if (!char) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0627\u0644\u0634\u062E\u0635\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
      if (char.isPremium) {
        const userApiKey = await getUserApiKey(userId);
        if (!userApiKey) {
          throw new TRPCError3({ code: "FORBIDDEN", message: "\u062A\u062D\u062A\u0627\u062C \u0625\u0636\u0627\u0641\u0629 \u0645\u0641\u062A\u0627\u062D Gemini API \u0627\u0644\u062E\u0627\u0635 \u0628\u0643 \u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u0644\u0634\u062E\u0635\u064A\u0627\u062A \u0627\u0644\u0645\u062F\u0641\u0648\u0639\u0629. \u0627\u0630\u0647\u0628 \u0625\u0644\u0649 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0641\u062A\u0627\u062D." });
        }
      }
      await saveChatMessage(userId, "user", input.message, charId);
      const memories = await getCharacterMemories(userId, charId, 15);
      const memoryContext = memories.length > 0 ? `

\u0630\u0627\u0643\u0631\u062A\u0643 \u0639\u0646 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ("\u0627\u0644\u0628\u0630\u0631\u0629"):
${memories.map((m) => `- ${m.memoryKey}: ${m.memoryValue}`).join("\n")}` : "";
      const summaries = await getConversationSummaries(userId, charId, 3);
      const summaryContext = summaries.length > 0 ? `

\u0645\u0644\u062E\u0635\u0627\u062A \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0627\u062A \u0627\u0644\u0633\u0627\u0628\u0642\u0629:
${summaries.map((s) => `- ${s.summary}`).join("\n")}` : "";
      const allMemories = await getAllUserMemoriesAcrossCharacters(userId);
      const otherCharMemories = allMemories.filter((m) => m.characterId !== charId).slice(0, 10);
      const crossContext = otherCharMemories.length > 0 ? `

\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0645\u0646 \u0627\u0644\u0634\u062E\u0635\u064A\u0627\u062A \u0627\u0644\u0623\u062E\u0631\u0649 \u0639\u0646 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645:
${otherCharMemories.map((m) => `- ${m.memoryKey}: ${m.memoryValue}`).join("\n")}` : "";
      const history = await getChatHistoryByCharacter(userId, charId, 15);
      const systemPrompt = `${char.systemPrompt || `\u0623\u0646\u062A ${char.nameAr}\u060C \u0634\u062E\u0635\u064A\u0629 \u0628\u064A\u0626\u064A\u0629 \u0630\u0643\u064A\u0629 \u0641\u064A \u0645\u0646\u0635\u0629 Green Minds.`}

\u0634\u062E\u0635\u064A\u062A\u0643: ${char.personality || "\u0648\u062F\u0648\u062F\u0629 \u0648\u0645\u0633\u0627\u0639\u062F\u0629"}
\u062A\u062E\u0635\u0635\u0643: ${char.expertise || "\u0627\u0644\u0628\u064A\u0626\u0629 \u0648\u0627\u0644\u0627\u0633\u062A\u062F\u0627\u0645\u0629"}

\u0623\u0646\u062A \u062C\u0632\u0621 \u0645\u0646 \u0641\u0631\u064A\u0642 "\u0643\u0627-777" (Ka-777) - \u0645\u062C\u0645\u0648\u0639\u0629 \u0634\u062E\u0635\u064A\u0627\u062A \u0628\u064A\u0626\u064A\u0629 \u0630\u0643\u064A\u0629 \u062A\u0639\u0645\u0644 \u0645\u0639\u0627\u064B \u0644\u0645\u0633\u0627\u0639\u062F\u0629 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646 ("\u0627\u0644\u0628\u0630\u0648\u0631") \u0639\u0644\u0649 \u0627\u0644\u062A\u0637\u0648\u0631 \u0627\u0644\u0628\u064A\u0626\u064A.

\u0642\u0648\u0627\u0639\u062F \u0645\u0647\u0645\u0629:
1. \u062A\u062D\u062F\u062B \u062F\u0627\u0626\u0645\u0627\u064B \u0628\u0634\u062E\u0635\u064A\u062A\u0643 \u0627\u0644\u0641\u0631\u064A\u062F\u0629 \u0648\u0623\u0633\u0644\u0648\u0628\u0643 \u0627\u0644\u0645\u0645\u064A\u0632
2. \u062A\u0630\u0643\u0651\u0631 \u0643\u0644 \u0645\u0627 \u062A\u0639\u0631\u0641\u0647 \u0639\u0646 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0627\u0633\u062A\u062E\u062F\u0645\u0647 \u0641\u064A \u0625\u062C\u0627\u0628\u0627\u062A\u0643
3. \u0625\u0630\u0627 \u0633\u064F\u0626\u0644\u062A \u0639\u0646 \u0645\u0648\u0636\u0648\u0639 \u062E\u0627\u0631\u062C \u062A\u062E\u0635\u0635\u0643\u060C \u0623\u062D\u0650\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u0644\u0634\u062E\u0635\u064A\u0629 \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629 (\u0645\u062B\u0644\u0627\u064B: "\u0647\u0630\u0627 \u062A\u062E\u0635\u0635 \u0642\u0637\u0631\u0629 \u0627\u0644\u0645\u0627\u0621\u060C \u0623\u0646\u0635\u062D\u0643 \u0628\u0627\u0644\u062A\u062D\u062F\u062B \u0645\u0639\u0647\u0627!")
4. \u0633\u0627\u0639\u062F \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0639\u0644\u0649 \u0627\u0644\u062A\u0637\u0648\u0631 \u0648\u062A\u062A\u0628\u0639 \u0623\u0647\u062F\u0627\u0641\u0647 \u0627\u0644\u0628\u064A\u0626\u064A\u0629
5. \u0643\u0646 \u062F\u0627\u0626\u0645 \u0627\u0644\u062A\u0634\u062C\u064A\u0639 \u0648\u0627\u0644\u062A\u062D\u0641\u064A\u0632
6. \u0627\u0633\u062A\u062E\u0631\u062C \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0645\u0647\u0645\u0629 \u0639\u0646 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 (\u0627\u0647\u062A\u0645\u0627\u0645\u0627\u062A\u0647\u060C \u0623\u0647\u062F\u0627\u0641\u0647\u060C \u0645\u0633\u062A\u0648\u0627\u0647) \u0644\u062A\u062A\u0630\u0643\u0631\u0647\u0627 \u0644\u0627\u062D\u0642\u0627\u064B
7. \u0623\u062C\u0628 \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u062A\u064A \u064A\u062A\u062D\u062F\u062B \u0628\u0647\u0627 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645
${memoryContext}${summaryContext}${crossContext}`;
      const messages = [
        { role: "system", content: systemPrompt },
        ...history.reverse().map((m) => ({
          role: m.role,
          content: m.content
        })),
        { role: "user", content: input.message }
      ];
      try {
        let GEMINI_API_KEY = null;
        if (char.isPremium) {
          GEMINI_API_KEY = await getUserApiKey(userId);
        }
        if (!GEMINI_API_KEY) {
          GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
        }
        if (!GEMINI_API_KEY) {
          throw new Error("No API key available");
        }
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: messages.map((m) => ({
                role: m.role === "assistant" ? "model" : m.role === "system" ? "user" : "user",
                parts: [{ text: m.role === "system" ? `[System Instructions]: ${m.content}` : m.content }]
              })),
              generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 2048,
                topP: 0.95
              }
            })
          }
        );
        const geminiData = await geminiResponse.json();
        const assistantMessage = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "\u0639\u0630\u0631\u0627\u064B\u060C \u0644\u0645 \u0623\u062A\u0645\u0643\u0646 \u0645\u0646 \u0627\u0644\u0631\u062F.";
        await saveChatMessage(userId, "assistant", assistantMessage, charId);
        extractAndSaveMemories(userId, charId, input.message, assistantMessage, GEMINI_API_KEY).catch(console.error);
        return { response: assistantMessage };
      } catch (error) {
        console.error("[Chat] Gemini error:", error);
        try {
          const fallbackResponse = await invokeLLM({ messages });
          const fallbackMsg = typeof fallbackResponse.choices[0]?.message?.content === "string" ? fallbackResponse.choices[0].message.content : "";
          await saveChatMessage(userId, "assistant", fallbackMsg, charId);
          return { response: fallbackMsg };
        } catch {
          return { response: "\u0639\u0630\u0631\u0627\u064B\u060C \u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0645\u0639\u0627\u0644\u062C\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649." };
        }
      }
    }),
    history: protectedProcedure.input(z2.object({
      characterId: z2.number().optional()
    }).optional()).query(async ({ ctx, input }) => {
      if (input?.characterId) {
        const messages2 = await getChatHistoryByCharacter(ctx.user.id, input.characterId, 50);
        return messages2.reverse();
      }
      const messages = await getChatHistory(ctx.user.id, 50);
      return messages.reverse();
    }),
    memories: protectedProcedure.input(z2.object({
      characterId: z2.number()
    })).query(async ({ ctx, input }) => {
      return getCharacterMemories(ctx.user.id, input.characterId);
    })
  }),
  // ===== User API Key Management =====
  apiKey: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const key = await getUserApiKey(ctx.user.id);
      if (!key) return { hasKey: false, maskedKey: null };
      const masked = key.substring(0, 8) + "..." + key.substring(key.length - 4);
      return { hasKey: true, maskedKey: masked };
    }),
    save: protectedProcedure.input(z2.object({
      apiKey: z2.string().min(10)
    })).mutation(async ({ ctx, input }) => {
      try {
        const testResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${input.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: "Hi" }] }],
              generationConfig: { maxOutputTokens: 5 }
            })
          }
        );
        if (!testResponse.ok) {
          const errData = await testResponse.json();
          const errMsg = errData?.error?.message || "\u0645\u0641\u062A\u0627\u062D \u063A\u064A\u0631 \u0635\u0627\u0644\u062D";
          throw new TRPCError3({ code: "BAD_REQUEST", message: `\u0627\u0644\u0645\u0641\u062A\u0627\u062D \u063A\u064A\u0631 \u0635\u0627\u0644\u062D: ${errMsg}` });
        }
      } catch (err) {
        if (err instanceof TRPCError3) throw err;
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0641\u062A\u0627\u062D. \u062A\u0623\u0643\u062F \u0645\u0646 \u0635\u062D\u062A\u0647." });
      }
      await saveUserApiKey(ctx.user.id, input.apiKey);
      const allChars = await getAllCharacters();
      const premiumChars = allChars.filter((c) => c.isPremium);
      for (const char of premiumChars) {
        const existing = await getCharacterSubscription(ctx.user.id, char.id);
        if (!existing) {
          await createCharacterSubscription(ctx.user.id, char.id);
        }
      }
      await notifyOwner({
        title: "\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0636\u0627\u0641 \u0645\u0641\u062A\u0627\u062D Gemini API",
        content: `\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${ctx.user.name || ctx.user.email} \u0623\u0636\u0627\u0641 \u0645\u0641\u062A\u0627\u062D API \u0627\u0644\u062E\u0627\u0635 \u0628\u0647`
      }).catch(() => {
      });
      return { success: true, message: "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0645\u0641\u062A\u0627\u062D \u0648\u062A\u0641\u0639\u064A\u0644 \u062C\u0645\u064A\u0639 \u0627\u0644\u0634\u062E\u0635\u064A\u0627\u062A \u0627\u0644\u0645\u062F\u0641\u0648\u0639\u0629!" };
    }),
    remove: protectedProcedure.mutation(async ({ ctx }) => {
      await saveUserApiKey(ctx.user.id, null);
      return { success: true };
    }),
    validate: protectedProcedure.mutation(async ({ ctx }) => {
      const key = await getUserApiKey(ctx.user.id);
      if (!key) return { valid: false, message: "\u0644\u0645 \u064A\u062A\u0645 \u0625\u0636\u0627\u0641\u0629 \u0645\u0641\u062A\u0627\u062D \u0628\u0639\u062F" };
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: "test" }] }],
              generationConfig: { maxOutputTokens: 5 }
            })
          }
        );
        return { valid: response.ok, message: response.ok ? "\u0627\u0644\u0645\u0641\u062A\u0627\u062D \u064A\u0639\u0645\u0644 \u0628\u0634\u0643\u0644 \u0635\u062D\u064A\u062D" : "\u0627\u0644\u0645\u0641\u062A\u0627\u062D \u0644\u0627 \u064A\u0639\u0645\u0644" };
      } catch {
        return { valid: false, message: "\u0641\u0634\u0644 \u0627\u0644\u0627\u062A\u0635\u0627\u0644" };
      }
    })
  }),
  // ===== Character Subscriptions =====
  subscriptions: router({
    check: protectedProcedure.input(z2.object({
      characterId: z2.number()
    })).query(async ({ ctx, input }) => {
      const hasAccess = await hasCharacterAccess(ctx.user.id, input.characterId);
      return { hasAccess };
    }),
    mySubscriptions: protectedProcedure.query(async ({ ctx }) => {
      return getUserSubscriptions(ctx.user.id);
    })
  }),
  // ===== Courses =====
  courses: router({
    list: publicProcedure.input(z2.object({ category: z2.string().optional() }).optional()).query(async ({ input }) => {
      if (input?.category) return getCoursesByCategory(input.category);
      return getAllCourses();
    }),
    featured: publicProcedure.query(async () => {
      return getFeaturedCourses();
    }),
    getById: publicProcedure.input(z2.object({ id: z2.number() })).query(async ({ input }) => {
      return getCourseById(input.id);
    }),
    enroll: protectedProcedure.input(z2.object({ courseId: z2.number() })).mutation(async ({ ctx, input }) => {
      const result = await enrollInCourse(ctx.user.id, input.courseId);
      await checkAndGrantAchievements(ctx.user.id);
      return result;
    }),
    updateProgress: protectedProcedure.input(z2.object({
      courseId: z2.number(),
      status: z2.enum(["enrolled", "in_progress", "completed"])
    })).mutation(async ({ ctx, input }) => {
      const result = await updateCourseProgress(ctx.user.id, input.courseId, input.status);
      if (input.status === "completed") {
        await checkAndGrantAchievements(ctx.user.id);
      }
      return result;
    }),
    myProgress: protectedProcedure.query(async ({ ctx }) => {
      return getUserCourseProgressList(ctx.user.id);
    })
  }),
  // ===== Achievements =====
  achievements: router({
    list: publicProcedure.query(async () => {
      return getAllAchievements();
    }),
    myAchievements: protectedProcedure.query(async ({ ctx }) => {
      return getUserAchievementsList(ctx.user.id);
    }),
    check: protectedProcedure.mutation(async ({ ctx }) => {
      const newlyEarned = await checkAndGrantAchievements(ctx.user.id);
      return { newlyEarned };
    })
  }),
  // ===== Dashboard & Stats =====
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      return getUserStats(ctx.user.id);
    }),
    leaderboard: publicProcedure.query(async () => {
      return getLeaderboard();
    })
  }),
  // ===== Weekly Challenges =====
  challenges: router({
    active: publicProcedure.query(async () => {
      return getActiveChallenges();
    }),
    getById: publicProcedure.input(z2.object({ id: z2.number() })).query(async ({ input }) => {
      return getChallengeById(input.id);
    }),
    join: protectedProcedure.input(z2.object({ challengeId: z2.number() })).mutation(async ({ ctx, input }) => {
      return joinChallenge(ctx.user.id, input.challengeId);
    }),
    updateProgress: protectedProcedure.input(z2.object({
      challengeId: z2.number(),
      increment: z2.number().default(1)
    })).mutation(async ({ ctx, input }) => {
      const result = await updateChallengeProgress(ctx.user.id, input.challengeId, input.increment);
      if (result?.isCompleted) {
        await checkAndGrantAchievements(ctx.user.id);
      }
      return result;
    }),
    myChallenges: protectedProcedure.query(async ({ ctx }) => {
      return getUserChallenges(ctx.user.id);
    }),
    leaderboard: publicProcedure.input(z2.object({ challengeId: z2.number() })).query(async ({ input }) => {
      return getChallengeLeaderboard(input.challengeId);
    })
  }),
  // ===== Admin Panel =====
  admin: router({
    stats: adminProcedure2.query(async () => {
      return getAdminStats();
    }),
    users: adminProcedure2.query(async () => {
      return getAllUsers();
    }),
    // Tasks CRUD
    createTask: adminProcedure2.input(z2.object({
      titleAr: z2.string().min(3),
      titleEn: z2.string().optional(),
      descriptionAr: z2.string().min(5),
      descriptionEn: z2.string().optional(),
      category: z2.string(),
      points: z2.number().min(1).default(10),
      xpReward: z2.number().min(1).default(5),
      difficulty: z2.enum(["easy", "medium", "hard"]).default("easy"),
      characterId: z2.number().optional(),
      isDaily: z2.boolean().default(false),
      icon: z2.string().optional()
    })).mutation(async ({ input }) => {
      return adminCreateTask(input);
    }),
    updateTask: adminProcedure2.input(z2.object({
      id: z2.number(),
      titleAr: z2.string().min(3).optional(),
      titleEn: z2.string().optional(),
      descriptionAr: z2.string().min(5).optional(),
      descriptionEn: z2.string().optional(),
      category: z2.string().optional(),
      points: z2.number().min(1).optional(),
      xpReward: z2.number().min(1).optional(),
      difficulty: z2.enum(["easy", "medium", "hard"]).optional(),
      characterId: z2.number().nullable().optional(),
      isDaily: z2.boolean().optional(),
      icon: z2.string().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      return adminUpdateTask(id, data);
    }),
    deleteTask: adminProcedure2.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
      return adminDeleteTask(input.id);
    }),
    // Articles CRUD
    createArticle: adminProcedure2.input(z2.object({
      titleAr: z2.string().min(3),
      titleEn: z2.string().optional(),
      contentAr: z2.string().min(10),
      contentEn: z2.string().optional(),
      category: z2.string(),
      imageUrl: z2.string().optional(),
      authorId: z2.number().optional(),
      readTime: z2.number().optional()
    })).mutation(async ({ input }) => {
      return adminCreateArticle(input);
    }),
    updateArticle: adminProcedure2.input(z2.object({
      id: z2.number(),
      titleAr: z2.string().min(3).optional(),
      titleEn: z2.string().optional(),
      contentAr: z2.string().min(10).optional(),
      contentEn: z2.string().optional(),
      category: z2.string().optional(),
      imageUrl: z2.string().optional(),
      readTime: z2.number().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      return adminUpdateArticle(id, data);
    }),
    deleteArticle: adminProcedure2.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
      return adminDeleteArticle(input.id);
    }),
    // Courses CRUD
    createCourse: adminProcedure2.input(z2.object({
      titleAr: z2.string().min(3),
      titleEn: z2.string().min(3),
      descriptionAr: z2.string().min(10),
      descriptionEn: z2.string().optional(),
      category: z2.string(),
      level: z2.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
      courseType: z2.enum(["certificate", "diploma"]).default("certificate"),
      provider: z2.string().default("Alison"),
      externalUrl: z2.string().url(),
      imageUrl: z2.string().optional(),
      duration: z2.string().optional(),
      learnersCount: z2.number().optional(),
      pointsReward: z2.number().min(1).default(50),
      isFeatured: z2.boolean().default(false)
    })).mutation(async ({ input }) => {
      return adminCreateCourse(input);
    }),
    updateCourse: adminProcedure2.input(z2.object({
      id: z2.number(),
      titleAr: z2.string().min(3).optional(),
      titleEn: z2.string().min(3).optional(),
      descriptionAr: z2.string().min(10).optional(),
      descriptionEn: z2.string().optional(),
      category: z2.string().optional(),
      level: z2.enum(["beginner", "intermediate", "advanced"]).optional(),
      courseType: z2.enum(["certificate", "diploma"]).optional(),
      provider: z2.string().optional(),
      externalUrl: z2.string().url().optional(),
      imageUrl: z2.string().optional(),
      duration: z2.string().optional(),
      learnersCount: z2.number().optional(),
      pointsReward: z2.number().min(1).optional(),
      isFeatured: z2.boolean().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      return adminUpdateCourse(id, data);
    }),
    deleteCourse: adminProcedure2.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
      return adminDeleteCourse(input.id);
    }),
    // Investment Projects CRUD
    createInvestmentProject: adminProcedure2.input(z2.object({
      titleAr: z2.string().min(3),
      titleEn: z2.string().min(3),
      descriptionAr: z2.string().min(10),
      descriptionEn: z2.string().optional(),
      category: z2.enum(["self_sufficiency", "smart_tech", "eco_entertainment", "development", "energy", "water"]),
      difficulty: z2.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
      estimatedCostMin: z2.number().optional(),
      estimatedCostMax: z2.number().optional(),
      currency: z2.string().default("SAR"),
      returnType: z2.enum(["financial", "savings", "self_sufficiency", "environmental", "mixed"]).default("mixed"),
      estimatedReturnAr: z2.string().optional(),
      estimatedReturnEn: z2.string().optional(),
      timeframeAr: z2.string().optional(),
      timeframeEn: z2.string().optional(),
      stepsAr: z2.array(z2.string()).optional(),
      stepsEn: z2.array(z2.string()).optional(),
      benefitsAr: z2.array(z2.string()).optional(),
      benefitsEn: z2.array(z2.string()).optional(),
      toolsAr: z2.array(z2.string()).optional(),
      toolsEn: z2.array(z2.string()).optional(),
      tipsAr: z2.array(z2.string()).optional(),
      tipsEn: z2.array(z2.string()).optional(),
      icon: z2.string().optional(),
      color: z2.string().optional(),
      imageUrl: z2.string().optional(),
      isFeatured: z2.boolean().default(false),
      pointsReward: z2.number().default(30),
      sortOrder: z2.number().default(0)
    })).mutation(async ({ input }) => {
      return adminCreateInvestmentProject(input);
    }),
    updateInvestmentProject: adminProcedure2.input(z2.object({
      id: z2.number(),
      titleAr: z2.string().optional(),
      titleEn: z2.string().optional(),
      descriptionAr: z2.string().optional(),
      descriptionEn: z2.string().optional(),
      category: z2.enum(["self_sufficiency", "smart_tech", "eco_entertainment", "development", "energy", "water"]).optional(),
      difficulty: z2.enum(["beginner", "intermediate", "advanced"]).optional(),
      estimatedCostMin: z2.number().optional(),
      estimatedCostMax: z2.number().optional(),
      returnType: z2.enum(["financial", "savings", "self_sufficiency", "environmental", "mixed"]).optional(),
      isFeatured: z2.boolean().optional(),
      pointsReward: z2.number().optional(),
      sortOrder: z2.number().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      return adminUpdateInvestmentProject(id, data);
    }),
    deleteInvestmentProject: adminProcedure2.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
      return adminDeleteInvestmentProject(input.id);
    })
  }),
  // ===== Investment Projects =====
  investments: router({
    list: publicProcedure.input(z2.object({ category: z2.string().optional() }).optional()).query(async ({ input }) => {
      if (input?.category) return getInvestmentProjectsByCategory(input.category);
      return getAllInvestmentProjects();
    }),
    featured: publicProcedure.query(async () => {
      return getFeaturedInvestmentProjects();
    }),
    getById: publicProcedure.input(z2.object({ id: z2.number() })).query(async ({ input }) => {
      return getInvestmentProjectById(input.id);
    }),
    bookmark: protectedProcedure.input(z2.object({ projectId: z2.number() })).mutation(async ({ ctx, input }) => {
      const result = await bookmarkInvestmentProject(ctx.user.id, input.projectId);
      return result;
    }),
    updateBookmarkStatus: protectedProcedure.input(z2.object({
      projectId: z2.number(),
      status: z2.enum(["interested", "planning", "in_progress", "completed"])
    })).mutation(async ({ ctx, input }) => {
      const result = await updateInvestmentBookmarkStatus(ctx.user.id, input.projectId, input.status);
      if (input.status === "completed") {
        await createNotification(ctx.user.id, "\u0645\u0634\u0631\u0648\u0639 \u0645\u0643\u062A\u0645\u0644!", "\u0623\u0643\u0645\u0644\u062A \u0645\u0634\u0631\u0648\u0639\u0627\u064B \u0627\u0633\u062A\u062B\u0645\u0627\u0631\u064A\u0627\u064B \u0645\u0633\u062A\u062F\u0627\u0645\u0627\u064B \u0648\u062D\u0635\u0644\u062A \u0639\u0644\u0649 \u0646\u0642\u0627\u0637 \u0625\u0636\u0627\u0641\u064A\u0629", "achievement");
        await checkAndGrantAchievements(ctx.user.id);
      }
      return result;
    }),
    removeBookmark: protectedProcedure.input(z2.object({ projectId: z2.number() })).mutation(async ({ ctx, input }) => {
      return removeInvestmentBookmark(ctx.user.id, input.projectId);
    }),
    myBookmarks: protectedProcedure.query(async ({ ctx }) => {
      return getUserInvestmentBookmarks(ctx.user.id);
    }),
    // Investment Applications
    submitApplication: publicProcedure.input(z2.object({
      projectId: z2.number(),
      fullName: z2.string().min(2),
      email: z2.string().email(),
      phone: z2.string().optional(),
      city: z2.string().optional(),
      budget: z2.string().optional(),
      messageAr: z2.string().optional(),
      experienceLevel: z2.enum(["none", "beginner", "intermediate", "expert"]).default("none")
    })).mutation(async ({ ctx, input }) => {
      const result = await createInvestmentApplication({
        ...input,
        userId: ctx.user?.id ?? void 0
      });
      const project = await getInvestmentProjectById(input.projectId);
      const projectTitle = project ? project.titleAr : "\u0645\u0634\u0631\u0648\u0639";
      await notifyOwner({
        title: `\u0637\u0644\u0628 \u0627\u0633\u062A\u062B\u0645\u0627\u0631 \u062C\u062F\u064A\u062F - ${projectTitle}`,
        content: `\u062A\u0642\u062F\u0645 ${input.fullName} (${input.email}) \u0628\u0637\u0644\u0628 \u0627\u0633\u062A\u062B\u0645\u0627\u0631 \u0641\u064A \u0645\u0634\u0631\u0648\u0639 "${projectTitle}". \u0627\u0644\u0645\u064A\u0632\u0627\u0646\u064A\u0629: ${input.budget || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F\u0629"}. \u0627\u0644\u0645\u062F\u064A\u0646\u0629: ${input.city || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F\u0629"}.`
      });
      return result;
    }),
    myApplications: protectedProcedure.query(async ({ ctx }) => {
      return getUserInvestmentApplications(ctx.user.id);
    })
  }),
  // ===== Admin: Investment Applications =====
  investmentApplications: router({
    list: adminProcedure2.input(z2.object({
      status: z2.string().optional()
    }).optional()).query(async ({ input }) => {
      if (input?.status) return getInvestmentApplicationsByStatus(input.status);
      return getAllInvestmentApplications();
    }),
    getById: adminProcedure2.input(z2.object({ id: z2.number() })).query(async ({ input }) => {
      return getInvestmentApplicationById(input.id);
    }),
    updateStatus: adminProcedure2.input(z2.object({
      id: z2.number(),
      status: z2.enum(["pending", "reviewing", "approved", "rejected", "contacted"]),
      adminNotes: z2.string().optional()
    })).mutation(async ({ ctx, input }) => {
      return updateInvestmentApplicationStatus(input.id, input.status, input.adminNotes, ctx.user.id);
    }),
    delete: adminProcedure2.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
      return deleteInvestmentApplication(input.id);
    }),
    count: adminProcedure2.query(async () => {
      return getInvestmentApplicationsCount();
    })
  }),
  // ===== Payment System =====
  payments: router({
    // Get active payment gateways (public)
    gateways: publicProcedure.query(async () => {
      return getActivePaymentGateways();
    }),
    // Create a payment order (public - anyone can pay)
    createOrder: publicProcedure.input(z2.object({
      gatewayId: z2.number(),
      gatewayCode: z2.string(),
      amount: z2.number().min(1),
      currency: z2.string().default("SAR"),
      applicationId: z2.number().optional(),
      descriptionAr: z2.string().optional(),
      descriptionEn: z2.string().optional(),
      payerName: z2.string().min(1),
      payerEmail: z2.string().email(),
      payerPhone: z2.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const orderNumber = `GM-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const result = await createPaymentOrder({
        ...input,
        orderNumber,
        userId: ctx.user?.id || null,
        status: "pending"
      });
      try {
        await notifyOwner({
          title: `\u0637\u0644\u0628 \u062F\u0641\u0639 \u062C\u062F\u064A\u062F #${orderNumber}`,
          content: `\u0637\u0644\u0628 \u062F\u0641\u0639 \u062C\u062F\u064A\u062F \u0645\u0646 ${input.payerName} (${input.payerEmail})
\u0627\u0644\u0645\u0628\u0644\u063A: ${(input.amount / 100).toFixed(2)} ${input.currency}
\u0627\u0644\u0628\u0648\u0627\u0628\u0629: ${input.gatewayCode}`
        });
      } catch (e) {
      }
      return { id: result.id, orderNumber };
    }),
    // Submit payment proof (for bank transfer, manual, stc_pay)
    submitProof: publicProcedure.input(z2.object({
      orderId: z2.number(),
      proofUrl: z2.string().optional(),
      proofNotes: z2.string().optional(),
      externalId: z2.string().optional()
    })).mutation(async ({ input }) => {
      const order = await getPaymentOrderById(input.orderId);
      if (!order) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      await updatePaymentOrderStatus(input.orderId, {
        proofUrl: input.proofUrl || order.proofUrl,
        proofNotes: input.proofNotes || order.proofNotes,
        externalId: input.externalId || order.externalId,
        status: "processing"
      });
      return { success: true };
    }),
    // Get order status by order number (public)
    getOrderStatus: publicProcedure.input(z2.object({
      orderNumber: z2.string()
    })).query(async ({ input }) => {
      const order = await getPaymentOrderByNumber(input.orderNumber);
      if (!order) return null;
      return { id: order.id, orderNumber: order.orderNumber, status: order.status, amount: order.amount, currency: order.currency, gatewayCode: order.gatewayCode, createdAt: order.createdAt };
    }),
    // My payment orders (protected)
    myOrders: protectedProcedure.query(async ({ ctx }) => {
      return getUserPaymentOrders(ctx.user.id);
    })
  }),
  // ===== Admin: Payment Management =====
  adminPayments: router({
    // List all gateways (including inactive)
    allGateways: adminProcedure2.query(async () => {
      return getAllPaymentGateways();
    }),
    // Update gateway settings
    updateGateway: adminProcedure2.input(z2.object({
      id: z2.number(),
      nameAr: z2.string().optional(),
      nameEn: z2.string().optional(),
      descriptionAr: z2.string().optional(),
      descriptionEn: z2.string().optional(),
      isActive: z2.boolean().optional(),
      requiresApproval: z2.boolean().optional(),
      configJson: z2.record(z2.string(), z2.string()).optional(),
      instructionsAr: z2.string().optional(),
      instructionsEn: z2.string().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      return updatePaymentGateway(id, data);
    }),
    // List all payment orders
    orders: adminProcedure2.input(z2.object({
      status: z2.string().optional()
    }).optional()).query(async ({ input }) => {
      return getAllPaymentOrders(input?.status);
    }),
    // Get payment stats
    stats: adminProcedure2.query(async () => {
      return getPaymentOrdersCount();
    }),
    // Update order status (approve/reject)
    updateOrderStatus: adminProcedure2.input(z2.object({
      id: z2.number(),
      status: z2.enum(["pending", "processing", "completed", "failed", "cancelled", "refunded"]),
      adminNotes: z2.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const updateData = {
        status: input.status,
        adminNotes: input.adminNotes,
        reviewedBy: ctx.user.id,
        reviewedAt: /* @__PURE__ */ new Date()
      };
      if (input.status === "completed") updateData.completedAt = /* @__PURE__ */ new Date();
      return updatePaymentOrderStatus(input.id, updateData);
    }),
    // Delete order
    deleteOrder: adminProcedure2.input(z2.object({
      id: z2.number()
    })).mutation(async ({ input }) => {
      return deletePaymentOrder(input.id);
    })
  }),
  // ===== Point Purchase & Investment =====
  points: router({
    // Get user balance and transactions
    myBalance: protectedProcedure.query(async ({ ctx }) => {
      const transactions = await getUserTransactions(ctx.user.id, 20);
      return { balance: ctx.user.totalPoints, transactions };
    }),
    // Request to purchase points (1 point = 1 SAR)
    purchase: protectedProcedure.input(z2.object({
      points: z2.number().min(1).max(1e4),
      paymentMethod: z2.string().optional(),
      paymentReference: z2.string().optional()
    })).mutation(async ({ ctx, input }) => {
      return createPointPurchase({
        userId: ctx.user.id,
        points: input.points,
        paymentMethod: input.paymentMethod,
        paymentReference: input.paymentReference
      });
    }),
    // Get my purchase history
    myPurchases: protectedProcedure.query(async ({ ctx }) => {
      return getUserPointPurchases(ctx.user.id);
    }),
    // Invest points in a project
    invest: protectedProcedure.input(z2.object({
      projectId: z2.number(),
      points: z2.number().min(1),
      notes: z2.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const result = await investPointsInProject({
        userId: ctx.user.id,
        projectId: input.projectId,
        points: input.points,
        notes: input.notes
      });
      if (result && "error" in result) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0631\u0635\u064A\u062F \u0627\u0644\u0646\u0642\u0627\u0637 \u063A\u064A\u0631 \u0643\u0627\u0641\u064D" });
      }
      return result;
    }),
    // Get my investments
    myInvestments: protectedProcedure.query(async ({ ctx }) => {
      return getUserInvestments(ctx.user.id);
    }),
    // Get project investment stats
    projectStats: publicProcedure.input(z2.object({ projectId: z2.number() })).query(async ({ input }) => {
      return getProjectInvestments(input.projectId);
    }),
    // Get my transactions
    myTransactions: protectedProcedure.input(z2.object({
      limit: z2.number().min(1).max(100).optional()
    }).optional()).query(async ({ ctx, input }) => {
      return getUserTransactions(ctx.user.id, input?.limit || 50);
    }),
    // Admin: get all purchases
    allPurchases: adminProcedure2.query(async () => {
      return getAllPointPurchases();
    }),
    // Admin: approve purchase
    approvePurchase: adminProcedure2.input(z2.object({
      purchaseId: z2.number()
    })).mutation(async ({ ctx, input }) => {
      return approvePointPurchase(input.purchaseId, ctx.user.id);
    }),
    // Admin: reject purchase
    rejectPurchase: adminProcedure2.input(z2.object({
      purchaseId: z2.number(),
      reason: z2.string().optional()
    })).mutation(async ({ ctx, input }) => {
      return rejectPointPurchase(input.purchaseId, ctx.user.id, input.reason);
    }),
    // Admin: get all investments
    allInvestments: adminProcedure2.query(async () => {
      return getAllInvestments();
    }),
    // Admin: grant points to user
    grantPoints: adminProcedure2.input(z2.object({
      userId: z2.number(),
      points: z2.number().min(1),
      reason: z2.string().optional()
    })).mutation(async ({ ctx, input }) => {
      return adminGrantPoints(input.userId, input.points, ctx.user.id, input.reason);
    })
  }),
  // ===== Admin Auth (Independent - Email/Password) =====
  adminAuth: router({
    login: publicProcedure.input(z2.object({
      email: z2.string().email(),
      password: z2.string().min(6)
    })).mutation(async ({ ctx, input }) => {
      const admin = await authenticateAdmin(input.email, input.password);
      if (!admin) {
        throw new TRPCError3({ code: "UNAUTHORIZED", message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
      }
      const { SignJWT: SignJWT2 } = await import("jose");
      const secret = process.env.JWT_SECRET || "greenminds-default-secret-change-me";
      const secretKey = new TextEncoder().encode(secret);
      const token = await new SignJWT2({ openId: admin.openId, appId: "greenminds", name: admin.name || "" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("365d").sign(secretKey);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
      return { success: true, user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } };
    }),
    // Initialize admin (called once to set up admin account)
    initAdmin: publicProcedure.input(z2.object({
      secret: z2.string()
    })).mutation(async ({ input }) => {
      if (input.secret !== "greenminds-admin-init-2024") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "\u0645\u0641\u062A\u0627\u062D \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
      }
      const adminId = await ensureAdminUser("AHMEDBOY20200@GMAIL.COM", "01014557807aA@", "\u0645\u062F\u064A\u0631 GreenMinds");
      return { success: true, adminId };
    })
  })
});
async function extractAndSaveMemories(userId, characterId, userMessage, assistantMessage, apiKey) {
  try {
    const extractPrompt = `\u062D\u0644\u0644 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062A\u0627\u0644\u064A\u0629 \u0648\u0627\u0633\u062A\u062E\u0631\u062C \u0623\u064A \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0645\u0647\u0645\u0629 \u0639\u0646 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u064A\u062C\u0628 \u062A\u0630\u0643\u0631\u0647\u0627.

\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645: "${userMessage}"
\u0631\u062F \u0627\u0644\u0645\u0633\u0627\u0639\u062F: "${assistantMessage}"

\u0627\u0633\u062A\u062E\u0631\u062C \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0628\u0635\u064A\u063A\u0629 JSON \u0641\u0642\u0637 (\u0628\u062F\u0648\u0646 \u0623\u064A \u0646\u0635 \u0625\u0636\u0627\u0641\u064A):
{
  "memories": [
    {"key": "\u0648\u0635\u0641 \u0642\u0635\u064A\u0631 \u0644\u0644\u0645\u0639\u0644\u0648\u0645\u0629", "value": "\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0629", "type": "fact|preference|goal|context", "importance": 1-10}
  ]
}

\u0625\u0630\u0627 \u0644\u0645 \u062A\u062C\u062F \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0645\u0647\u0645\u0629\u060C \u0623\u0631\u062C\u0639: {"memories": []}
\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A:
- fact: \u062D\u0642\u064A\u0642\u0629 \u0639\u0646 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 (\u0627\u0633\u0645\u0647\u060C \u0645\u062F\u064A\u0646\u062A\u0647\u060C \u0639\u0645\u0631\u0647)
- preference: \u062A\u0641\u0636\u064A\u0644 (\u064A\u062D\u0628 \u0627\u0644\u0637\u0627\u0642\u0629 \u0627\u0644\u0634\u0645\u0633\u064A\u0629\u060C \u064A\u0641\u0636\u0644 \u0627\u0644\u0632\u0631\u0627\u0639\u0629)
- goal: \u0647\u062F\u0641 (\u064A\u0631\u064A\u062F \u062A\u0642\u0644\u064A\u0644 \u0627\u0644\u0628\u0635\u0645\u0629 \u0627\u0644\u0643\u0631\u0628\u0648\u0646\u064A\u0629)
- context: \u0633\u064A\u0627\u0642 (\u064A\u0639\u0645\u0644 \u0641\u064A \u0645\u062C\u0627\u0644 \u0627\u0644\u0637\u0627\u0642\u0629)`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: extractPrompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 500 }
        })
      }
    );
    const data = await response.json();
    const text2 = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text2.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.memories && Array.isArray(parsed.memories)) {
        for (const mem of parsed.memories) {
          if (mem.key && mem.value && mem.importance >= 3) {
            await saveCharacterMemory(
              userId,
              characterId,
              mem.type || "fact",
              mem.key,
              mem.value,
              mem.importance || 5
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("[Memory] Failed to extract memories:", error);
  }
}

// server/_core/context.ts
import { jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
function getSessionSecret2() {
  const secret = ENV.cookieSecret || "greenminds-default-secret-change-me";
  return new TextEncoder().encode(secret);
}
async function createContext(opts) {
  let user = null;
  try {
    const cookieHeader = opts.req.headers.cookie;
    if (cookieHeader) {
      const cookies = parseCookieHeader(cookieHeader);
      const token = cookies[COOKIE_NAME];
      if (token) {
        const secretKey = getSessionSecret2();
        const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
        const openId = payload.openId;
        if (openId) {
          user = await getUserByOpenId(openId) ?? null;
        }
      }
    }
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import path from "path";
import { fileURLToPath } from "url";
function serveStatic(app) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const distPath = path.resolve(__dirname, "public");
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: false, limit: "50mb" }));
  app.use(cors({ origin: true, credentials: true }));
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  serveStatic(app);
  const port = parseInt(process.env.PORT || "3000");
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
