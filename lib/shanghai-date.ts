/** 东八区（上海）当日日期 YYYY-MM-DD，与数据库 vote_date 一致 */
export function shanghaiDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
