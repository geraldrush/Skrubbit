import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as South African Rand, e.g. 129.9 -> "R 129.90". */
export function formatZAR(amount: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    currencyDisplay: "symbol",
  })
    .format(amount)
    .replace("ZAR", "R")
    .replace(/ /g, " ");
}
