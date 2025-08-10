-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "corrections" TEXT[],
ADD COLUMN     "crudOperations" TEXT[],
ADD COLUMN     "dataEntities" TEXT[];

-- CreateTable
CREATE TABLE "components" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "functionality" TEXT,
    "userActions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "apiNeeded" TEXT NOT NULL,
    "dataModel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complexities" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "complexity" TEXT NOT NULL,
    "description" TEXT,
    "impact" TEXT NOT NULL,
    "solution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complexities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backend_functions" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "api" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backend_functions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complexities" ADD CONSTRAINT "complexities_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backend_functions" ADD CONSTRAINT "backend_functions_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
