/**
 * @license
 * Copyright 2026 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

export const DEADLINE_USAGE =
  '/ddl add <name> <YYYY-MM-DD> [HH:MM] [zone] · /ddl rm <name>';
export const DAY = 86_400_000;
const ZONES = {
  aoe: -720,
  utc: 0,
  gmt: 0,
  z: 0,
  hst: -600,
  akst: -540,
  akdt: -480,
  pst: -480,
  pdt: -420,
  mst: -420,
  mdt: -360,
  cst: -360,
  cdt: -300,
  est: -300,
  edt: -240,
  ast: -240,
  nst: -210,
  wet: 0,
  west: 60,
  bst: 60,
  cet: 60,
  cest: 120,
  eet: 120,
  eest: 180,
  msk: 180,
  ist: 330,
  pkt: 300,
  npt: 345,
  ict: 420,
  wib: 420,
  wita: 480,
  wit: 540,
  sgt: 480,
  hkt: 480,
  pht: 480,
  awst: 480,
  jst: 540,
  kst: 540,
  acst: 570,
  aest: 600,
  aedt: 660,
  nzst: 720,
  nzdt: 780,
};
const REGIONS = {
  pt: 'America/Los_Angeles',
  mt: 'America/Denver',
  ct: 'America/Chicago',
  et: 'America/New_York',
};

function wallTime(at, zone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const value = (key) => Number(parts.find((part) => part.type === key)?.value);
  return Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
  );
}

export function parseDeadline(
  input,
  localZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  const match = input
    .trim()
    .match(
      /^(.+?)\s+(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2}))?(?:\s+(\S+))?$/,
    );
  if (!match) throw new Error(`Usage: ${DEADLINE_USAGE}`);
  const [, name, year, month, day, hour = '23', minute = '59', zone = 'local'] =
    match;
  if (name.length > 120 || /\p{Cc}/u.test(name)) {
    throw new Error('Use a deadline name of 1 to 120 printable characters.');
  }
  const naive = Date.UTC(+year, +month - 1, +day, +hour, +minute);
  const date = new Date(naive);
  if (
    +year < 1000 ||
    date.getUTCFullYear() !== +year ||
    date.getUTCMonth() !== +month - 1 ||
    date.getUTCDate() !== +day ||
    +hour > 23 ||
    +minute > 59
  ) {
    throw new Error('Invalid date or time. Use YYYY-MM-DD and HH:MM.');
  }
  const word = zone.toLowerCase();
  const numeric = word.match(/^(?:utc|gmt)?([+-])(\d{1,2})(?::?(\d{2}))?$/);
  let offset = Object.hasOwn(ZONES, word) ? ZONES[word] : undefined;
  if (
    word === 'cst' &&
    ['Asia/Shanghai', 'Asia/Taipei', 'Asia/Chongqing', 'Asia/Harbin'].includes(
      localZone,
    )
  )
    offset = 480;
  if (numeric) {
    const hours = +numeric[2];
    const minutes = +(numeric[3] ?? 0);
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes > 0)) {
      throw new Error(
        'Invalid UTC offset. Use an offset between -14:00 and +14:00.',
      );
    }
    offset = (numeric[1] === '-' ? -1 : 1) * (hours * 60 + minutes);
  }
  if (offset !== undefined) return { name, at: naive - offset * 60_000 };
  const region =
    word === 'local'
      ? localZone
      : Object.hasOwn(REGIONS, word)
        ? REGIONS[word]
        : zone;
  try {
    const offsets = new Set(
      [-DAY, 0, DAY].map(
        (shift) => wallTime(naive + shift, region) - (naive + shift),
      ),
    );
    const matches = [...offsets]
      .map((delta) => naive - delta)
      .filter((at) => wallTime(at, region) === naive);
    if (matches.length !== 1) throw new Error('DST');
    return { name, at: matches[0] };
  } catch (error) {
    if (error instanceof RangeError)
      throw new Error(
        `Unknown time zone "${zone}". Use aoe, local, an IANA zone, or a UTC offset.`,
      );
    throw new Error(
      'This local time is ambiguous or does not exist because of daylight saving. Use a fixed UTC offset.',
    );
  }
}

export function timeLeft(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h ${minutes % 60}m`;
}

export function formatDeadline(at) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(at);
}
