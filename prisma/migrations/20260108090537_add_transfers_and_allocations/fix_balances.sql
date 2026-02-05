-- Script para corrigir inconsistências nos saldos após a migração
-- Este script recalcula total_balance e available_balance baseado nas transações

-- Primeiro, vamos recalcular total_balance e available_balance para todas as contas
-- baseado nas transações INCOME e EXPENSE (não TRANSFER ou ALLOCATION)

-- Para contas não-crédito:
-- total_balance = balance (já está correto da migração inicial)
-- available_balance = total_balance - allocated_balance

-- Para contas de crédito, o balance representa dívida (positivo), então:
-- total_balance = balance (já está correto)
-- available_balance não se aplica da mesma forma

-- Vamos recalcular baseado nas transações:
-- 1. Para cada conta, somar todas as transações INCOME/EXPENSE pagas
-- 2. Atualizar total_balance e available_balance

-- Nota: Este script assume que o campo balance já está correto
-- e apenas sincroniza total_balance e available_balance com ele

UPDATE "accounts" 
SET 
  "total_balance" = "balance",
  "available_balance" = CASE 
    WHEN "type" = 'CREDIT' THEN 0 -- Credit cards don't have available balance
    ELSE "balance" - COALESCE("allocated_balance", 0)
  END
WHERE "type" != 'CREDIT';

-- Para contas de crédito, manter total_balance = balance
UPDATE "accounts"
SET "total_balance" = "balance"
WHERE "type" = 'CREDIT';

