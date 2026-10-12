-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "sentences" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "english" TEXT NOT NULL,
    "chinese" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '其他',
    "sub_category" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "pronunciation" TEXT,
    "explanation" TEXT,
    "tags" TEXT,
    "audio_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "parent_id" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "user_sentence_progress" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "sentence_id" INTEGER NOT NULL,
    "practice_count" INTEGER NOT NULL DEFAULT 0,
    "correct_count" INTEGER NOT NULL DEFAULT 0,
    "wrong_count" INTEGER NOT NULL DEFAULT 0,
    "consecutive_correct" INTEGER NOT NULL DEFAULT 0,
    "mastery_level" INTEGER NOT NULL DEFAULT 0,
    "last_practice_at" DATETIME,
    "next_review_at" DATETIME,
    CONSTRAINT "user_sentence_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_sentence_progress_sentence_id_fkey" FOREIGN KEY ("sentence_id") REFERENCES "sentences" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "sentence_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "favorites_sentence_id_fkey" FOREIGN KEY ("sentence_id") REFERENCES "sentences" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "practice_records" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "sentence_id" INTEGER NOT NULL,
    "practice_type" TEXT NOT NULL,
    "user_answer" TEXT,
    "correct" BOOLEAN NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "practice_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "practice_records_sentence_id_fkey" FOREIGN KEY ("sentence_id") REFERENCES "sentences" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_name_key" ON "users"("name");

-- CreateIndex
CREATE INDEX "sentences_category_idx" ON "sentences"("category");

-- CreateIndex
CREATE UNIQUE INDEX "sentences_english_key" ON "sentences"("english");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "user_sentence_progress_user_id_next_review_at_idx" ON "user_sentence_progress"("user_id", "next_review_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_sentence_progress_user_id_sentence_id_key" ON "user_sentence_progress"("user_id", "sentence_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_sentence_id_key" ON "favorites"("user_id", "sentence_id");

-- CreateIndex
CREATE INDEX "practice_records_user_id_created_at_idx" ON "practice_records"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "practice_records_sentence_id_idx" ON "practice_records"("sentence_id");
