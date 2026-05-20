-- BahayGo articles & guides (homepage spotlight + /blog)

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  body text not null default '',
  category text not null default 'MARKET INSIGHTS',
  cover_image_url text not null default '',
  read_minutes smallint not null default 5 check (read_minutes > 0 and read_minutes <= 60),
  published boolean not null default false,
  published_at timestamptz,
  homepage_featured boolean not null default false,
  homepage_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.articles is 'BahayGo articles & guides; managed in admin, shown on /blog and homepage.';
comment on column public.articles.homepage_featured is 'When true, eligible for homepage cards (max 3 by homepage_order).';
comment on column public.articles.homepage_order is 'Lower numbers appear first on homepage (0–2 recommended).';

create index if not exists articles_published_at_idx on public.articles (published, published_at desc nulls last);
create index if not exists articles_homepage_featured_idx on public.articles (homepage_featured, homepage_order)
  where published = true and homepage_featured = true;

alter table public.articles enable row level security;

drop policy if exists articles_public_read_published on public.articles;
create policy articles_public_read_published on public.articles
  for select
  using (published = true);

-- Seed starter articles (edit/delete in admin)
insert into public.articles (
  slug,
  title,
  excerpt,
  body,
  category,
  cover_image_url,
  read_minutes,
  published,
  published_at,
  homepage_featured,
  homepage_order
) values
(
  'why-bgc-remains-top-real-estate-investment-metro-manila',
  'Why BGC Remains the Top Real Estate Investment in Metro Manila',
  'BGC continues to lead in growth, lifestyle, and long-term value. Here''s why investors and end-users love it.',
  E'Bonifacio Global City (BGC) has become the benchmark for master-planned urban living in the Philippines. For buyers comparing Makati CBD, Ortigas, and newer townships, BGC often wins on walkability, security, and tenant demand.\n\n**Strong rental demand.** BPO offices, embassies, and multinational headquarters keep professional renters in the area year-round. Well-managed condos with parking, gym access, and reliable property management tend to lease faster than comparable units in older districts.\n\n**Infrastructure that compounds value.** The combination of retail (Uptown, High Street, Market! Market!), hospitals, international schools, and direct links to C5 and NAIA makes daily life practical—not just impressive on a brochure.\n\n**What to look for before you buy or rent.** Prioritize buildings with clear association dues, documented permits, and transparent parking rules. Ask your BahayGo agent for recent comparable leases in the same tower so you can sanity-check price per square meter.\n\n**Bottom line.** BGC is not the cheapest entry point in Metro Manila, but it remains one of the most liquid markets for both end-users and investors who care about resale depth and rental stability.',
  'LOCATION GUIDE',
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&h=675&fit=crop',
  5,
  true,
  now(),
  true,
  0
),
(
  'best-finds-tagaytay-homes-cafes-weekend-escapes',
  'Best Finds in Tagaytay: Homes, Cafés & Weekend Escapes',
  'Discover the best spots to eat, relax, and unwind in Tagaytay — perfect for weekends or future living.',
  E'Tagaytay works double duty: a cool-climate weekend escape and a growing second-home market for Metro Manila families. If you are browsing listings on BahayGo, it helps to know the lifestyle pockets—not just the highway-frontage developments.\n\n**Where people actually spend time.** Picnic Grove and Sky Ranch anchor family weekends; newer café rows along Aguinaldo Highway favor slow brunches with Taal views. For quieter stays, look toward Mendez and Alfonso-side subdivisions with stricter HOA rules and greener setbacks.\n\n**Homes vs. condotels.** Houses and lots offer space for gardens and pets; condotels can pencil for short-stay income but require honest occupancy data from the seller. Verify whether the unit is zoned for transient use and what the building''s Airbnb policy is.\n\n**Commute reality.** Weekend traffic on Aguinaldo can add hours. If you plan weekday living, test a Tuesday-morning drive to your office before committing.\n\n**Agent tip.** Ask for utility history (mist often raises heating costs) and whether fog season affects mobile signal—small details that matter when you work from home.',
  'LOCAL FINDS',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=675&fit=crop',
  5,
  true,
  now(),
  true,
  1
),
(
  'top-tourist-destinations-philippines-2026',
  'Top Tourist Destinations in the Philippines for 2026',
  'From pristine beaches to cultural hotspots, explore must-visit places—and how travel shapes where people buy.',
  E'Domestic travel is back in a big way, and it quietly influences where Filipinos and foreign residents choose second homes. These destinations show up often in BahayGo searches—not only for vacation rentals but for relocation scouting.\n\n**Palawan and El Nido.** Limestone lagoons and island-hopping keep demand high for boutique resorts and small eco-lodges. Environmental regulations are tightening; verify land titles and easements before any beachfront purchase.\n\n**Cebu and Bohol.** Mactan''s airport hub supports international access; Bohol adds heritage tourism and newer resort belts. Condo inventory near IT parks remains popular with balikbayan buyers.\n\n**Siargao and surf towns.** Lifestyle migration continues, but infrastructure is catch-up. Water, power, and road access should be verified in person, not only on video tours.\n\n**How this ties to real estate.** Tourism hotspots can support short-term rental strategies—but permitting, HOA rules, and tax registration vary by LGU. Work with a verified BahayGo agent who has closed deals in that specific municipality, not just the province.\n\n**Plan a scout trip.** The best investment is often a long weekend on the ground: morning traffic, evening safety, and grocery access tell you more than any listing photo.',
  'TRAVEL GUIDE',
  'https://images.unsplash.com/photo-1518509562904-7f99983c77b2?w=1200&h=675&fit=crop',
  5,
  true,
  now(),
  true,
  2
)
on conflict (slug) do nothing;
