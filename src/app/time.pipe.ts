import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'isDisabled1hBefore', pure: true })
export class IsDisabled1hBeforePipe implements PipeTransform {
  private monthIndex(m: string): number {
    const key = m.trim().toLowerCase();
    const map: Record<string, number> = {
      jan:0, ene:0, enero:0,
      feb:1, febr:1, febrero:1,
      mar:2, marzo:2,
      apr:3, abr:3, abril:3,
      may:4, mayo:4,
      jun:5, junio:5,
      jul:6, julio:6,
      aug:7, ago:7, agosto:7,
      sep:8, sept:8, septiembre:8,
      oct:9, octubre:9,
      nov:10, noviembre:10,
      dec:11, dic:11, diciembre:11,
    };
    // soporta “Oct”, “oct”, “Octubre”, etc.
    const short = key.slice(0,3);
    return map[key] ?? map[short] ?? -1;
  }

  transform(dateStr: string, timeStr: string, nowRef?: Date): boolean {
    if (!dateStr || !timeStr) return false;

    // dateStr: "31 Oct"  | timeStr: "20:00"
    const [dayRaw, monthRaw] = dateStr.replace(/\s*\|\s*.*/, '').trim().split(/\s+/);
    const [hh, mm] = timeStr.trim().split(':').map(n => parseInt(n, 10));
    const day = parseInt(dayRaw, 10);
    const month = this.monthIndex(monthRaw || '');
    if (isNaN(day) || month < 0 || isNaN(hh) || isNaN(mm)) return false;

    const now = nowRef ?? new Date();

    // asumimos año actual; si la fecha “parece” ya haber pasado por cruce de año (ej. hoy Dic y fecha Ene), saltamos al próximo año
    let year = now.getFullYear();
    const tentative = new Date(year, month, day, hh, mm, 0, 0);
    if (tentative.getTime() + 6e4 < now.getTime()) {
      // si ya pasó y el mes objetivo está "antes" que el mes actual, quizá era del siguiente año
      if (month < now.getMonth()) {
        year += 1;
      }
    }

    const target = new Date(year, month, day, hh, mm, 0, 0);
    const threshold = new Date(target.getTime() - 60 * 60 * 1000); // 1 hora antes
    return now >= threshold; // true => deshabilitar
  }
}
