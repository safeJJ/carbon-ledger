const months: Record<string, number> = {
  "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
  "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12,
};

const calendarYear = (value: string) => {
  const year = Number(value);
  return year >= 2400 && year <= 2700 ? year - 543 : year;
};

export function periodDateRange(label: string): { start: string; end: string } | null {
  const monthYears = [...label.matchAll(/(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s*((?:19|20|24|25|26)\d{2})/g)];
  if (monthYears.length) {
    const first = monthYears[0];
    const last = monthYears[monthYears.length - 1];
    const startYear = calendarYear(first[2]);
    const endYear = calendarYear(last[2]);
    const startMonth = months[first[1]];
    const endMonth = months[last[1]];
    const start = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;
    const endDay = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
    const end = `${endYear}-${String(endMonth).padStart(2, "0")}-${endDay}`;
    return start <= end ? { start, end } : null;
  }

  const years = [...label.matchAll(/(?:19|20|24|25|26)\d{2}/g)].map(match => calendarYear(match[0]));
  if (!years.length) return null;
  const start = `${years[0]}-01-01`;
  const end = `${years[years.length - 1]}-12-31`;
  return start <= end ? { start, end } : null;
}

export function dateMatchesPeriod(date: string, label: string): boolean {
  const range = periodDateRange(label);
  return !range || (date >= range.start && date <= range.end);
}
