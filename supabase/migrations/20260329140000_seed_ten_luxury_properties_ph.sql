-- Replace all listings with 10 luxury Philippines test properties (destructive reseed)

delete from public.properties;

insert into public.properties (location, price, sqft, beds, baths, image_url) values
  (
    'Bonifacio Global City, Taguig',
    '₱185,000,000',
    '5,400',
    5,
    6,
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=600&fit=crop'
  ),
  (
    'Rockwell Center, Makati',
    '₱92,500,000',
    '3,200',
    4,
    4,
    'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop'
  ),
  (
    'Ayala Alabang, Muntinlupa',
    '₱128,000,000',
    '6,800',
    6,
    7,
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop'
  ),
  (
    'Tagaytay Highlands, Cavite',
    '₱75,000,000',
    '4,100',
    4,
    5,
    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop'
  ),
  (
    'Forbes Park, Makati',
    '₱248,000,000',
    '9,200',
    7,
    8,
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop'
  ),
  (
    'Dasmariñas Village, Makati',
    '₱195,000,000',
    '7,500',
    6,
    7,
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop'
  ),
  (
    'Valle Verde, Pasig',
    '₱68,000,000',
    '3,950',
    5,
    5,
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop'
  ),
  (
    'Corinthian Gardens, Quezon City',
    '₱55,000,000',
    '3,600',
    4,
    4,
    'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=600&fit=crop'
  ),
  (
    'Lahug, Cebu City',
    '₱42,000,000',
    '2,900',
    4,
    3,
    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&h=600&fit=crop'
  ),
  (
    'Capitol Commons, Pasig',
    '₱112,000,000',
    '4,750',
    5,
    5,
    'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&h=600&fit=crop'
  );
