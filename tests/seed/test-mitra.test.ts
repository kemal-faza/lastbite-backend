import { describe, it, expect } from 'vitest';
import fs from 'fs';

// File-based validation of seed.ts mitra assignments.
// Reads the seed file directly to avoid interference from the
// global test setup's beforeEach (which clears all database data).

describe('Seed Mitra Accounts', () => {
  const seedContent = fs.readFileSync('prisma/seed.ts', 'utf-8');

  it('should define exactly 5 mitra seeds with correct emails', () => {
    const match = seedContent.match(/const MITRA_SEEDS = \[([\s\S]*?)\] as const;/);
    expect(match).not.toBeNull();

    const mitraEmails = Array.from(match![1].matchAll(/email:\s*["']([^"']+)["']/g)).map(
      (m) => m[1],
    );

    expect(mitraEmails.length).toBe(5);

    const sorted = [...mitraEmails].sort();
    expect(sorted).toEqual([
      'bakeria@lastbite.id',
      'dapurbuani@lastbite.id',
      'kopiaroma@lastbite.id',
      'mieayam@lastbite.id',
      'rmpadang@lastbite.id',
    ]);
  });

  it('should assign products to correct mitra in getDefaultProducts', () => {
    // Scope search to the getDefaultProducts function body only
    const funcMatch = seedContent.match(/function getDefaultProducts\([\s\S]*?\n\}/);
    expect(funcMatch).not.toBeNull();
    const funcBody = funcMatch![0];

    // Map variable names (dapurbuaniId, rmpadangId, etc.) to emails
    const varToEmail: Record<string, string> = {
      dapurbuaniId: 'dapurbuani@lastbite.id',
      rmpadangId: 'rmpadang@lastbite.id',
      bakeriaId: 'bakeria@lastbite.id',
      kopiaromaId: 'kopiaroma@lastbite.id',
      mieayamId: 'mieayam@lastbite.id',
    };

    // Extract product blocks: capture name + mitraId value
    const productRegex = /name:\s*"([^"]+)"[\s\S]*?mitraId:\s*(\w+),/g;
    const productToMitra: Record<string, string> = {};
    let m;

    while ((m = productRegex.exec(funcBody)) !== null) {
      const name = m[1];
      const varName = m[2];
      expect(
        varToEmail[varName],
        `Unknown mitraId variable "${varName}" for product "${name}"`,
      ).toBeDefined();
      productToMitra[name] = varToEmail[varName];
    }

    expect(Object.keys(productToMitra).length).toBe(8);

    expect(productToMitra['Ayam Preksu']).toBe('dapurbuani@lastbite.id');
    expect(productToMitra['Nasi Goreng Kampung']).toBe('dapurbuani@lastbite.id');
    expect(productToMitra['Nasi Padang']).toBe('rmpadang@lastbite.id');
    expect(productToMitra['Roti Coklat']).toBe('bakeria@lastbite.id');
    expect(productToMitra['Roti Keju']).toBe('bakeria@lastbite.id');
    expect(productToMitra['Kopi Susu Gula Aren']).toBe('kopiaroma@lastbite.id');
    expect(productToMitra['Es Teh Tarik']).toBe('kopiaroma@lastbite.id');
    expect(productToMitra['Mie Ayam Komplit']).toBe('mieayam@lastbite.id');
  });
});
