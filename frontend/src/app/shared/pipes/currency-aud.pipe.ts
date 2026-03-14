import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'aud', standalone: true })
export class AudCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals = 0): string {
    if (value == null) return '$0';
    const neg = value < 0;
    const abs = Math.abs(value);
    const rounded = decimals > 0 ? abs.toFixed(decimals) : Math.round(abs).toString();
    const [intPart, decPart] = rounded.split('.');
    const formatted = parseInt(intPart).toLocaleString('en-AU');
    const dollar = decPart ? `$${formatted}.${decPart}` : `$${formatted}`;
    return neg ? `-${dollar}` : dollar;
  }
}

@Pipe({ name: 'audSigned', standalone: true })
export class AudSignedPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value == null) return '$0';
    const rounded = Math.round(value);
    const formatted = Math.abs(rounded).toLocaleString('en-AU');
    if (rounded >= 0) return `+$${formatted}`;
    return `-$${formatted}`;
  }
}
