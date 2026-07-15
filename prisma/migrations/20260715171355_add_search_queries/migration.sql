-- CreateTable
CREATE TABLE "search_queries" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_queries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_queries_count_idx" ON "search_queries"("count" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "search_queries_query_key" ON "search_queries"("query");
