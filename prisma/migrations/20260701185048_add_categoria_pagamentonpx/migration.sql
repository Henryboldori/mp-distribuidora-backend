-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('DINHEIRO', 'PIX', 'CARTAO', 'FIADO');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PAGO', 'PENDENTE');

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "categoria" TEXT,
ADD COLUMN     "observacoes" TEXT;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "formaPagamento" "FormaPagamento" NOT NULL DEFAULT 'DINHEIRO',
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "statusPagamento" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE';

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "categoria" TEXT DEFAULT 'Geral',
ADD COLUMN     "unidade" TEXT NOT NULL DEFAULT 'Unidade';
