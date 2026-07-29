-- CreateEnum
CREATE TYPE "Salutation" AS ENUM ('MR', 'MS');

-- AlterTable
ALTER TABLE "customer_contacts" ADD COLUMN     "salutation" "Salutation";

-- AlterTable
ALTER TABLE "customer_travellers" ADD COLUMN     "salutation" "Salutation";

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "salutation" "Salutation";
