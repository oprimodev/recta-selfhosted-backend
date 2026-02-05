#!/usr/bin/env tsx
/**
 * Script para criar 100 transações de teste para um usuário específico
 * 
 * Usage:
 *   npx tsx src/scripts/create-test-transactions.ts
 */

import 'dotenv/config';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../shared/db/prisma.js';
import { CategoryName, TransactionType, CategoryType } from '../shared/enums/index.js';
import { createTransaction } from '../modules/transactions/transactions.service.js';
import type { CreateTransactionInput } from '../modules/transactions/transactions.schema.js';

const USER_EMAIL = 'lucmanut@gmail.com';
const NUM_TRANSACTIONS = 100;

// Categorias de receita
const INCOME_CATEGORIES: CategoryName[] = [
  CategoryName.SALARY,
  CategoryName.FREELANCE,
  CategoryName.INVESTMENTS,
  CategoryName.SALES,
  CategoryName.RENTAL_INCOME,
  CategoryName.OTHER_INCOME,
];

// Categorias de despesa
const EXPENSE_CATEGORIES: CategoryName[] = [
  CategoryName.FOOD,
  CategoryName.TRANSPORTATION,
  CategoryName.HOUSING,
  CategoryName.HEALTHCARE,
  CategoryName.EDUCATION,
  CategoryName.ENTERTAINMENT,
  CategoryName.CLOTHING,
  CategoryName.UTILITIES,
  CategoryName.SUBSCRIPTIONS,
  CategoryName.ONLINE_SHOPPING,
  CategoryName.GROCERIES,
  CategoryName.RESTAURANT,
  CategoryName.FUEL,
  CategoryName.PHARMACY,
  CategoryName.OTHER_EXPENSES,
];

// Descrições de exemplo para receitas
const INCOME_DESCRIPTIONS = [
  'Salário mensal',
  'Freelance projeto',
  'Dividendos',
  'Venda de produto',
  'Aluguel recebido',
  'Rendimento de investimento',
  'Pagamento de cliente',
  'Bônus',
];

// Descrições de exemplo para despesas
const EXPENSE_DESCRIPTIONS = [
  'Supermercado',
  'Restaurante',
  'Uber',
  'Farmácia',
  'Conta de luz',
  'Netflix',
  'Combustível',
  'Roupas',
  'Academia',
  'Internet',
  'Almoço',
  'Café',
  'Cinema',
  'Livros',
  'Medicamentos',
];

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomAmount(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function normalizeDate(date: Date): Date {
  // Normaliza a data para meia-noite local (sem horas/minutos/segundos)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

async function main() {
  console.log(`🔍 Procurando usuário com email: ${USER_EMAIL}`);

  // Encontrar usuário pelo email
  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
  });

  if (!user) {
    console.error(`❌ Usuário com email ${USER_EMAIL} não encontrado`);
    process.exit(1);
  }

  console.log(`✅ Usuário encontrado: ${user.id}`);

  // Encontrar household pessoal (o mais antigo)
  const userMemberships = await prisma.householdMember.findMany({
    where: { userId: user.id },
    include: { household: true },
    orderBy: { createdAt: 'asc' },
  });

  if (userMemberships.length === 0) {
    console.error(`❌ Usuário não possui nenhum household`);
    process.exit(1);
  }

  const personalHousehold = userMemberships[0].household;
  console.log(`✅ Household pessoal encontrado: ${personalHousehold.id} - ${personalHousehold.name}`);

  // Encontrar uma conta ativa do household
  const accounts = await prisma.account.findMany({
    where: {
      householdId: personalHousehold.id,
      isActive: true,
      status: 'ACTIVE',
      type: { in: ['CHECKING', 'SAVINGS', 'CASH'] }, // Não usar cartão de crédito para transações simples
    },
    take: 1,
  });

  if (accounts.length === 0) {
    console.error(`❌ Nenhuma conta ativa encontrada no household`);
    process.exit(1);
  }

  const account = accounts[0];
  console.log(`✅ Conta encontrada: ${account.id} - ${account.name} (${account.type})`);

  // Criar transações de teste
  console.log(`\n📝 Criando ${NUM_TRANSACTIONS} transações de teste...`);

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3); // Últimos 3 meses
  const endDate = new Date();

  let created = 0;
  let errors = 0;

  // Criar 60% de despesas e 40% de receitas
  const numExpenses = Math.floor(NUM_TRANSACTIONS * 0.6);
  const numIncomes = NUM_TRANSACTIONS - numExpenses;

  // Criar receitas
  for (let i = 0; i < numIncomes; i++) {
    try {
      const category = randomElement(INCOME_CATEGORIES);
      const amount = randomAmount(500, 5000);
      const date = randomDate(startDate, endDate);
      const description = randomElement(INCOME_DESCRIPTIONS);

      const input: CreateTransactionInput = {
        householdId: personalHousehold.id,
        type: TransactionType.INCOME,
        accountId: account.id,
        categoryName: category,
        amount,
        description: `${description} ${i + 1}`,
        date: normalizeDate(date),
        paid: true,
        isSplit: false,
      };

      await createTransaction(input, user.id);
      created++;
      
      if ((created + errors) % 10 === 0) {
        console.log(`  Progresso: ${created + errors}/${NUM_TRANSACTIONS}`);
      }
    } catch (error) {
      console.error(`  ❌ Erro ao criar transação ${i + 1}:`, error);
      errors++;
    }
  }

  // Criar despesas
  for (let i = 0; i < numExpenses; i++) {
    try {
      const category = randomElement(EXPENSE_CATEGORIES);
      const amount = randomAmount(10, 500);
      const date = randomDate(startDate, endDate);
      const description = randomElement(EXPENSE_DESCRIPTIONS);

      const input: CreateTransactionInput = {
        householdId: personalHousehold.id,
        type: TransactionType.EXPENSE,
        accountId: account.id,
        categoryName: category,
        amount,
        description: `${description} ${i + 1}`,
        date: normalizeDate(date),
        paid: true,
        isSplit: false,
      };

      await createTransaction(input, user.id);
      created++;
      
      if ((created + errors) % 10 === 0) {
        console.log(`  Progresso: ${created + errors}/${NUM_TRANSACTIONS}`);
      }
    } catch (error) {
      console.error(`  ❌ Erro ao criar transação ${numIncomes + i + 1}:`, error);
      errors++;
    }
  }

  console.log(`\n✅ Concluído!`);
  console.log(`   Transações criadas: ${created}`);
  console.log(`   Erros: ${errors}`);
  console.log(`   Total processado: ${created + errors}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
