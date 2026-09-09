/**
 * A single illustrative example campaign shared by all five Process stages.
 *
 * Every figure rendered inside the Process journey is derived from this file so
 * the stages describe one coherent campaign (understand the music → understand
 * the audience → build the strategy → launch → optimise) instead of each visual
 * inventing its own unrelated numbers. The data is demonstrative, not a record
 * of a real client campaign.
 */

export const campaignNote = "Illustrative campaign data";

/** Stage 01 — the track being analysed. */
export const campaignTrack = {
  tempo: ["142 BPM"],
  energy: [78, 80, 76, 79],
  mood: ["Atmospheric", "Energetic"],
  genre: ["Melodic Rap"],
  genreSub: ["Alternative"],
  audience: ["18–24", "25–34"],
  region: ["UK"],
} as const;

/** Stage 02 — the audience that track indexes against. */
export const campaignAudience = {
  age: ["18–24", "25–34"],
  location: ["UK", "London", "Manchester"],
  platform: ["TikTok", "Instagram"],
  behaviour: [
    "High Engagement",
    "Repeat Listeners",
    "Trend Responsive",
    "High Save Rate",
  ],
  interest: [
    "Rap / R&B",
    "Melodic Rap",
    "Fashion",
    "Nightlife",
    "Music Discovery",
  ],
} as const;

/** Stage 03 — the plan agreed before launch. */
export const campaignPlan = {
  budget: 5000,
  budgetLabel: "£5,000",
  durationDays: 21,
  durationLabel: "21 DAYS",
  assets: 18,
  assetsLabel: "18 ASSETS",
  creators: 4,
  shortlisted: 18,
  platforms: 4,
  creatorItems: ["18 shortlisted", "4 priority"],
  contentItems: [
    ["Performance clips", "Lifestyle", "Trend-led"],
    ["Short-form", "Artist content", "Trend-led"],
  ],
  paidItems: ["TikTok Ads", "Meta", "Retargeting"],
} as const;

/**
 * Channel mix used by stage 04 and stage 05. TikTok and Instagram carry the
 * organic/creator content, Meta and TikTok Ads carry paid, and Spotify is the
 * destination the traffic is pushed towards.
 */
export const campaignChannels = {
  tiktok: { name: "TikTok", role: "SHORT-FORM VIDEO", detail: "ACTIVE · 10 ASSETS" },
  meta: { name: "Meta", role: "SOCIAL ADS", detail: "ACTIVE · 4 AD SETS" },
  instagram: { name: "Instagram", role: "REELS & STORIES", detail: "ACTIVE · 8 ASSETS" },
  spotify: { name: "Spotify", role: "DSP TRAFFIC", detail: "TRAFFIC ACTIVE" },
} as const;

/** Budget split at launch. Totals 100. */
export const campaignAllocation = {
  tiktok: 40,
  meta: 35,
  instagram: 15,
  spotify: 10,
} as const;

/**
 * Stage 04 in-flight reallocations. Each step returns to the launch split at
 * the end of the cycle, and every caption matches the values actually shown.
 */
export const campaignAllocationSteps = [
  {
    channel: "tiktok",
    to: { tiktok: 44, meta: 32, instagram: 14, spotify: 10 },
    label: "40% → 44%",
  },
  {
    channel: "meta",
    to: { tiktok: 42, meta: 36, instagram: 12, spotify: 10 },
    label: "32% → 36%",
  },
  {
    channel: "instagram",
    to: { tiktok: 40, meta: 35, instagram: 15, spotify: 10 },
    label: "12% → 15%",
  },
] as const;

/** Stage 04 performance envelope. Spend never exceeds the agreed budget. */
export const campaignPerformance = {
  reachStart: 348,
  reachTarget: 501,
  reachFloor: 300,
  reachCeiling: 525,
  reachDelta: "+48.2%",
  engageStart: 8.1,
  engageMin: 7.4,
  engageMax: 9.8,
  engageDelta: "+8.1%",
  spendStart: 1080,
  spendTarget: 4650,
  spendFloor: 900,
  assetsAtLaunch: 12,
  creatorsAtLaunch: 2,
  axis: ["LAUNCH", "DAY 5", "DAY 10", "DAY 15", "DAY 21"],
} as const;

/**
 * Stage 05 continues directly from the stage 04 figures: reach picks up where
 * launch plateaus, and the allocation sets start from the launch split.
 */
export const campaignOptimisation = {
  metrics: [
    { id: "ctr", label: "CTR", from: "3.8%", steps: ["4.1%", "4.3%", "4.6%"] },
    { id: "cpc", label: "CPC", from: "£0.42", steps: ["£0.39", "£0.35", "£0.31"] },
    {
      id: "engagement",
      label: "Engagement",
      from: "8.4%",
      steps: ["8.8%", "9.2%", "9.7%"],
    },
    {
      id: "reach",
      label: "Reach",
      from: "501K",
      steps: ["528K", "556K", "584K"],
    },
    {
      id: "conversion",
      label: "Conversion",
      from: "+12.6%",
      steps: ["+14.2%", "+16.1%", "+18.4%"],
    },
  ],
  allocationSets: [
    { tiktok: 40, meta: 35, instagram: 15, spotify: 10 },
    { tiktok: 43, meta: 33, instagram: 14, spotify: 10 },
    { tiktok: 45, meta: 32, instagram: 13, spotify: 10 },
    { tiktok: 42, meta: 34, instagram: 14, spotify: 10 },
  ],
} as const;
