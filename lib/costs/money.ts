export interface Fraction {
  numerator: bigint;
  denominator: bigint;
}

export function decimal(value: number): Fraction {
  if (!Number.isFinite(value)) throw new Error("A finite number is required");
  const [mantissa, exponent = "0"] = String(value).split("e");
  const [whole, digits = ""] = mantissa!.split(".");
  const scale = digits.length - Number(exponent);
  const numerator = BigInt(whole! + digits);
  return scale >= 0
    ? { numerator, denominator: 10n ** BigInt(scale) }
    : { numerator: numerator * 10n ** BigInt(-scale), denominator: 1n };
}

export function add(a: Fraction, b: Fraction): Fraction {
  return {
    numerator: a.numerator * b.denominator + b.numerator * a.denominator,
    denominator: a.denominator * b.denominator,
  };
}

export function multiply(a: Fraction, b: Fraction): Fraction {
  return {
    numerator: a.numerator * b.numerator,
    denominator: a.denominator * b.denominator,
  };
}

export function divide(a: Fraction, b: Fraction): Fraction {
  if (b.numerator <= 0n) throw new Error("A positive divisor is required");
  return multiply(a, { numerator: b.denominator, denominator: b.numerator });
}

function safeNumber(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result))
    throw new Error("Money exceeds the safe integer range");
  return result;
}

export function round(value: Fraction): number {
  const sign = value.numerator < 0n ? -1n : 1n;
  const abs = value.numerator * sign;
  return safeNumber(
    sign * ((abs * 2n + value.denominator) / (2n * value.denominator)),
  );
}

export function currencyAmount(
  amountMinor: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): Fraction {
  if (!Number.isSafeInteger(amountMinor))
    throw new Error("Money must be integer minor units");
  if (from === to) return decimal(amountMinor);
  // Rates are units of the foreign currency per one unit of the trip currency.
  const rate = rates[from];
  if (rate === undefined || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(
      `Set a positive ${from}/${to} exchange rate before computing costs`,
    );
  }
  return divide(decimal(amountMinor), decimal(rate));
}

export function convertMinor(
  amountMinor: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number {
  return round(currencyAmount(amountMinor, from, to, rates));
}

export function allocate(
  shares: { memberId: string; amount: Fraction }[],
): Map<string, number> {
  const total = round(
    shares.reduce((sum, s) => add(sum, s.amount), decimal(0)),
  );
  const entries = shares.map(({ memberId, amount }) => {
    const floor = amount.numerator / amount.denominator;
    return {
      memberId,
      floor: safeNumber(floor),
      remainder: {
        numerator: amount.numerator % amount.denominator,
        denominator: amount.denominator,
      },
    };
  });
  let remainder = total - entries.reduce((sum, s) => sum + s.floor, 0);
  const sorted = [...entries].sort((a, b) => {
    const diff =
      b.remainder.numerator * a.remainder.denominator -
      a.remainder.numerator * b.remainder.denominator;
    if (diff !== 0n) return diff > 0n ? 1 : -1;
    return a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0;
  });
  const result = new Map(entries.map((s) => [s.memberId, s.floor]));
  for (const entry of sorted) {
    if (remainder === 0) break;
    result.set(entry.memberId, entry.floor + 1);
    remainder--;
  }
  return result;
}

export function parseMinor(value: string): number {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error("Enter a money amount with at most two decimal places");
  }
  const negative = value.startsWith("-");
  const [whole, cents = ""] = value.replace(/^-/, "").split(".");
  return safeNumber(
    (negative ? -1n : 1n) *
      (BigInt(whole!) * 100n + BigInt(cents.padEnd(2, "0"))),
  );
}

export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    amountMinor / 100,
  );
}
