import clsx from "clsx";

export function cx(...args: any[]) {
  return clsx(...args);
}

export function fmtTime(d: string | number | Date) {
  const date = new Date(d);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
