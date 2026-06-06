// Busca dados de fast foods em Orlando via Google Places API (New)
  // Roda diariamente via GitHub Actions e atualiza places.json

  const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
  if (!API_KEY) { console.error('Faltou GOOGLE_PLACES_API_KEY'); process.exit(1); }

  const BRANDS = [
    "McDonald's",
    "Burger King",
    "Wendy's",                               
    "Taco Bell",                                                                                      
    "Chick-fil-A",
    "Starbucks",
    "Five Guys",
    "7-Eleven",
  ];
                                             
  // Caixa geográfica cobrindo toda a região turística de Orlando
  const BOUNDS = {
    low:  { latitude: 28.20, longitude: -81.75 },
    high: { latitude: 28.65, longitude: -81.20 },
  };                                         

  const FIELD_MASK = [
    'places.id',                             
    'places.displayName',                                                                             
    'places.formattedAddress',
    'places.location',
    'places.nationalPhoneNumber',
    'places.regularOpeningHours.periods',
    'places.regularOpeningHours.weekdayDescriptions',
    'places.businessStatus',
  ].join(',');                                                                                        

  async function searchBrand(brand) {
    const all = [];                          
    let pageToken = null;                                                                             
    do {
      const body = {
        textQuery: `${brand} Orlando FL`,
        locationRestriction: { rectangle: BOUNDS },
        pageSize: 20,                        
        ...(pageToken ? { pageToken } : {}),
      };
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type':   'application/json',                                                       
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify(body),                                                                   
      });
      if (!res.ok) {
        const err = await res.text();        
        throw new Error(`Places API ${res.status}: ${err}`);                                          
      }
      const data = await res.json();
      if (data.places) all.push(...data.places);
      pageToken = data.nextPageToken;
      if (pageToken) await new Promise(r => setTimeout(r, 2000)); // token precisa "aquecer"
    } while (pageToken);
    return all;
  }

  function brandSlug(brand) {
    return brand.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-');
  }

  async function main() {
    const result = {
      generatedAt: new Date().toISOString(), 
      bounds: BOUNDS,
      brands: {},
    };
  
    for (const brand of BRANDS) {            
      console.log(`Buscando ${brand}...`);                                                            
      const places = await searchBrand(brand);
      const slug   = brandSlug(brand);
      result.brands[slug] = {
        label: brand,
        locations: places                    
          .filter(p => p.location && p.businessStatus !== 'CLOSED_PERMANENTLY')
          .map(p => ({
            id:      p.id,                   
            name:    p.displayName?.text || brand,
            address: p.formattedAddress || '',
            lat:     p.location.latitude,    
            lon:     p.location.longitude,
            phone:   p.nationalPhoneNumber || '',
            periods: p.regularOpeningHours?.periods || [],
            weekdayDescriptions: p.regularOpeningHours?.weekdayDescriptions || [],
            status:  p.businessStatus || 'OPERATIONAL',
          })),
      };
      console.log(`  ${result.brands[slug].locations.length} locais`);
      await new Promise(r => setTimeout(r, 500));
    }

    const fs = require('fs');
    fs.writeFileSync('places.json', JSON.stringify(result, null, 2));
    console.log('places.json escrito');      
  }

  main().catch(err => { console.error(err); process.exit(1); });
