export type CreatorVideo = {
  id: string;
  creator: string;
  username: string;
  platform: "tiktok" | "instagram";
  url: string;
  likes: number;
};

/**
 * Top 25 TikTok + 25 Instagram by like count, kept as even as possible
 * across AJ Tracey, Gigi Moss, Mellina Tey and Kian Cyrs.
 * The carousel samples a random subset of this pool on each page load.
 */
export const creatorVideos = [
  {
    id: "7424060409914592544",
    creator: "AJ Tracey",
    username: "@ajtracey",
    platform: "tiktok",
    url: "https://www.tiktok.com/@ajtracey/video/7424060409914592544",
    likes: 364800,
  },
  {
    id: "7488507237049109782",
    creator: "Mellina Tey",
    username: "@mellinatey",
    platform: "tiktok",
    url: "https://www.tiktok.com/@mellinatey/video/7488507237049109782",
    likes: 149600,
  },
  {
    id: "7545520423933463830",
    creator: "Kian Cyrs",
    username: "@kiancyrs",
    platform: "tiktok",
    url: "https://www.tiktok.com/@kiancyrs/video/7545520423933463830",
    likes: 103600,
  },
  {
    id: "7559214783879204118",
    creator: "Gigi Moss",
    username: "@itsgigimoss",
    platform: "tiktok",
    url: "https://www.tiktok.com/@itsgigimoss/video/7559214783879204118",
    likes: 80400,
  },
  {
    id: "7556360221438872854",
    creator: "Gigi Moss",
    username: "@itsgigimoss",
    platform: "tiktok",
    url: "https://www.tiktok.com/@itsgigimoss/video/7556360221438872854",
    likes: 77800,
  },
  {
    id: "7523901924807019798",
    creator: "Mellina Tey",
    username: "@mellinatey",
    platform: "tiktok",
    url: "https://www.tiktok.com/@mellinatey/video/7523901924807019798",
    likes: 63700,
  },
  {
    id: "7539119877211131158",
    creator: "Gigi Moss",
    username: "@itsgigimoss",
    platform: "tiktok",
    url: "https://www.tiktok.com/@itsgigimoss/video/7539119877211131158",
    likes: 59900,
  },
  {
    id: "7554485308427865366",
    creator: "Mellina Tey",
    username: "@mellinatey",
    platform: "tiktok",
    url: "https://www.tiktok.com/@mellinatey/video/7554485308427865366",
    likes: 57000,
  },
  {
    id: "7557312030915464470",
    creator: "Gigi Moss",
    username: "@itsgigimoss",
    platform: "tiktok",
    url: "https://www.tiktok.com/@itsgigimoss/video/7557312030915464470",
    likes: 55400,
  },
  {
    id: "7593014549331086614",
    creator: "AJ Tracey",
    username: "@ajtracey",
    platform: "tiktok",
    url: "https://www.tiktok.com/@ajtracey/video/7593014549331086614",
    likes: 53900,
  },
  {
    id: "7524320604095384854",
    creator: "Mellina Tey",
    username: "@mellinatey",
    platform: "tiktok",
    url: "https://www.tiktok.com/@mellinatey/video/7524320604095384854",
    likes: 52200,
  },
  {
    id: "7588638414061243670",
    creator: "Gigi Moss",
    username: "@itsgigimoss",
    platform: "tiktok",
    url: "https://www.tiktok.com/@itsgigimoss/video/7588638414061243670",
    likes: 47100,
  },
  {
    id: "7599752149949549846",
    creator: "AJ Tracey",
    username: "@ajtracey",
    platform: "tiktok",
    url: "https://www.tiktok.com/@ajtracey/video/7599752149949549846",
    likes: 42900,
  },
  {
    id: "7466903346369088801",
    creator: "AJ Tracey",
    username: "@ajtracey",
    platform: "tiktok",
    url: "https://www.tiktok.com/@ajtracey/video/7466903346369088801",
    likes: 41900,
  },
  {
    id: "7408563703848701217",
    creator: "Mellina Tey",
    username: "@mellinatey",
    platform: "tiktok",
    url: "https://www.tiktok.com/@mellinatey/video/7408563703848701217",
    likes: 41200,
  },
  {
    id: "7666147535009942806",
    creator: "AJ Tracey",
    username: "@ajtracey",
    platform: "tiktok",
    url: "https://www.tiktok.com/@ajtracey/video/7666147535009942806",
    likes: 40900,
  },
  {
    id: "7585957127710051606",
    creator: "Gigi Moss",
    username: "@itsgigimoss",
    platform: "tiktok",
    url: "https://www.tiktok.com/@itsgigimoss/video/7585957127710051606",
    likes: 40900,
  },
  {
    id: "7663659615720344854",
    creator: "Gigi Moss",
    username: "@itsgigimoss",
    platform: "tiktok",
    url: "https://www.tiktok.com/@itsgigimoss/video/7663659615720344854",
    likes: 40200,
  },
  {
    id: "7636468168365509910",
    creator: "Kian Cyrs",
    username: "@kiancyrs",
    platform: "tiktok",
    url: "https://www.tiktok.com/@kiancyrs/video/7636468168365509910",
    likes: 37900,
  },
  {
    id: "7544826657069092118",
    creator: "Kian Cyrs",
    username: "@kiancyrs",
    platform: "tiktok",
    url: "https://www.tiktok.com/@kiancyrs/video/7544826657069092118",
    likes: 35100,
  },
  {
    id: "7491055678929292566",
    creator: "Mellina Tey",
    username: "@mellinatey",
    platform: "tiktok",
    url: "https://www.tiktok.com/@mellinatey/video/7491055678929292566",
    likes: 33600,
  },
  {
    id: "7548123756338744598",
    creator: "Kian Cyrs",
    username: "@kiancyrs",
    platform: "tiktok",
    url: "https://www.tiktok.com/@kiancyrs/video/7548123756338744598",
    likes: 27400,
  },
  {
    id: "7545168106465856790",
    creator: "Kian Cyrs",
    username: "@kiancyrs",
    platform: "tiktok",
    url: "https://www.tiktok.com/@kiancyrs/video/7545168106465856790",
    likes: 25100,
  },
  {
    id: "7555568818916003095",
    creator: "Kian Cyrs",
    username: "@kiancyrs",
    platform: "tiktok",
    url: "https://www.tiktok.com/@kiancyrs/video/7555568818916003095",
    likes: 23500,
  },
  {
    id: "CjFraKxgV69",
    creator: "Kian Cyrs",
    username: "@kiancyrs",
    platform: "instagram",
    url: "https://www.instagram.com/reel/CjFraKxgV69/",
    likes: 230023,
  },
  {
    id: "DNiHhriM72l",
    creator: "Gigi Moss",
    username: "@itsgigimoss",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DNiHhriM72l/",
    likes: 97463,
  },
  {
    id: "DWQwdgpDYMG",
    creator: "Gigi Moss",
    username: "@itsgigimoss",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DWQwdgpDYMG/",
    likes: 96519,
  },
  {
    id: "DRr2S5yDG2H",
    creator: "Kian Cyrs",
    username: "@kiancyrs",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DRr2S5yDG2H/",
    likes: 81312,
  },
  {
    id: "DPoUh7NDMq0",
    creator: "Gigi Moss",
    username: "@itsgigimoss",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DPoUh7NDMq0/",
    likes: 70509,
  },
  {
    id: "DQuMH9qjG7S",
    creator: "Kian Cyrs",
    username: "@kiancyrs",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DQuMH9qjG7S/",
    likes: 56860,
  },
  {
    id: "DRNBY0sDJNR",
    creator: "Kian Cyrs",
    username: "@kiancyrs",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DRNBY0sDJNR/",
    likes: 47041,
  },
  {
    id: "DZdFI6tt4TJ",
    creator: "Gigi Moss",
    username: "@itsgigimoss",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DZdFI6tt4TJ/",
    likes: 44563,
  },
  {
    id: "DXfID-SRm5n",
    creator: "AJ Tracey",
    username: "@ajtracey",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DXfID-SRm5n/",
    likes: 28301,
  },
  {
    id: "DP9N7iKDJjP",
    creator: "Kian Cyrs",
    username: "@kiancyrs",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DP9N7iKDJjP/",
    likes: 26268,
  },
  {
    id: "DTvj-qhgOm-",
    creator: "AJ Tracey",
    username: "@ajtracey",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DTvj-qhgOm-/",
    likes: 25620,
  },
  {
    id: "DZ2aHTEtSqG",
    creator: "Gigi Moss",
    username: "@itsgigimoss",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DZ2aHTEtSqG/",
    likes: 22597,
  },
  {
    id: "DP1qxAhDJ5s",
    creator: "Kian Cyrs",
    username: "@kiancyrs",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DP1qxAhDJ5s/",
    likes: 22459,
  },
  {
    id: "DXt6n7YjNTg",
    creator: "AJ Tracey",
    username: "@ajtracey",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DXt6n7YjNTg/",
    likes: 20676,
  },
  {
    id: "DPo3Ba4jJwp",
    creator: "Kian Cyrs",
    username: "@kiancyrs",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DPo3Ba4jJwp/",
    likes: 18260,
  },
  {
    id: "DTYHLb2DvrE",
    creator: "Mellina Tey",
    username: "@mellinatey",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DTYHLb2DvrE/",
    likes: 15097,
  },
  {
    id: "DL5S-XqNTER",
    creator: "Mellina Tey",
    username: "@mellinatey",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DL5S-XqNTER/",
    likes: 14623,
  },
  {
    id: "DTGcGzDig6A",
    creator: "Mellina Tey",
    username: "@mellinatey",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DTGcGzDig6A/",
    likes: 10533,
  },
  {
    id: "DWpGb2ZijcV",
    creator: "Mellina Tey",
    username: "@mellinatey",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DWpGb2ZijcV/",
    likes: 8617,
  },
  {
    id: "DZ0I2wxgf9z",
    creator: "AJ Tracey",
    username: "@ajtracey",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DZ0I2wxgf9z/",
    likes: 6581,
  },
  {
    id: "DTgAmIVilsu",
    creator: "Mellina Tey",
    username: "@mellinatey",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DTgAmIVilsu/",
    likes: 5634,
  },
  {
    id: "DTDnD_7ih9V",
    creator: "Mellina Tey",
    username: "@mellinatey",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DTDnD_7ih9V/",
    likes: 4648,
  },
  {
    id: "DC1DGNlsFzG",
    creator: "Gigi Moss",
    username: "@itsgigimoss",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DC1DGNlsFzG/",
    likes: 0,
  },
  {
    id: "DZnYQBkgypA",
    creator: "AJ Tracey",
    username: "@ajtracey",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DZnYQBkgypA/",
    likes: 0,
  },
  {
    id: "DZiGKwAgSzG",
    creator: "AJ Tracey",
    username: "@ajtracey",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DZiGKwAgSzG/",
    likes: 0,
  },
] as const satisfies readonly CreatorVideo[];

function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffleCreators(creators: string[]) {
  const next = [...creators];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = next[index];
    next[index] = next[swap];
    next[swap] = current;
  }
  return next;
}

function weightedIndex(weights: number[]) {
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return 0;
  let ticket = Math.random() * total;
  for (let index = 0; index < weights.length; index += 1) {
    ticket -= weights[index];
    if (ticket <= 0) return index;
  }
  return weights.length - 1;
}

function sampleWeighted(items: readonly CreatorVideo[], count: number) {
  const pool = [...items];
  const picked: CreatorVideo[] = [];
  const take = Math.min(count, pool.length);

  while (picked.length < take && pool.length > 0) {
    const hasLiked = pool.some((item) => item.likes > 0);
    const weights = pool.map((item) =>
      hasLiked && item.likes === 0 ? 0 : Math.max(item.likes, 1),
    );
    if (weights.every((weight) => weight === 0)) {
      picked.push(...pool.splice(0, take - picked.length));
      break;
    }
    const index = weightedIndex(weights);
    picked.push(pool.splice(index, 1)[0]);
  }

  return picked;
}

function pickPlatformSet(
  videos: readonly CreatorVideo[],
  platform: CreatorVideo["platform"],
  count: number,
) {
  const pool = videos.filter((video) => video.platform === platform);
  const byCreator = new Map<string, CreatorVideo[]>();
  for (const video of pool) {
    const list = byCreator.get(video.creator) ?? [];
    list.push(video);
    byCreator.set(video.creator, list);
  }

  const creators = Array.from(byCreator.keys());
  if (creators.length === 0) return [];

  const base = Math.floor(count / creators.length);
  let remainder = count % creators.length;
  const quotas = new Map<string, number>();
  for (const creator of shuffleCreators(creators)) {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    quotas.set(creator, base + extra);
  }

  const picked: CreatorVideo[] = [];
  for (const creator of creators) {
    const available = byCreator.get(creator) ?? [];
    const quota = Math.min(quotas.get(creator) ?? base, available.length);
    picked.push(...sampleWeighted(available, quota));
  }
  return picked;
}

export function pickRandomCarouselSet(
  videos: readonly CreatorVideo[] = creatorVideos,
) {
  const tiktokCount = randomInt(8, 16);
  const instagramCount = randomInt(8, 16);
  return [
    ...pickPlatformSet(videos, "tiktok", tiktokCount),
    ...pickPlatformSet(videos, "instagram", instagramCount),
  ];
}
