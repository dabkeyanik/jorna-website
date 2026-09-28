// A self-contained list of US cities for the location picker — no Places API,
// no network calls. Skewed toward metros with large South Asian communities
// (the marketplace's audience) plus the major cities generally. Each carries
// approximate center coordinates so selecting one hands the backend lat/lng for
// distance-based vendor matching, which free-typed text can't. Anything not
// listed still works as plain typed text (just without coordinates).

export interface City {
  name: string;
  state: string;
  lat: number;
  lng: number;
}

// [name, state, lat, lng]
type Row = [string, string, number, number];

const ROWS: Row[] = [
  // — New Jersey (dense South Asian corridor) —
  ["Jersey City", "NJ", 40.73, -74.07],
  ["Edison", "NJ", 40.52, -74.41],
  ["Iselin", "NJ", 40.57, -74.32],
  ["Woodbridge", "NJ", 40.56, -74.28],
  ["Piscataway", "NJ", 40.55, -74.46],
  ["North Brunswick", "NJ", 40.45, -74.48],
  ["East Brunswick", "NJ", 40.43, -74.42],
  ["Parsippany", "NJ", 40.86, -74.42],
  ["Bridgewater", "NJ", 40.6, -74.61],
  ["Princeton", "NJ", 40.35, -74.66],
  ["Plainsboro", "NJ", 40.33, -74.59],
  ["West Windsor", "NJ", 40.29, -74.62],
  ["Old Bridge", "NJ", 40.41, -74.31],
  ["Marlboro", "NJ", 40.32, -74.25],
  ["Hoboken", "NJ", 40.74, -74.03],
  ["Newark", "NJ", 40.74, -74.17],
  ["Jersey Shore", "NJ", 40.21, -74.03],

  // — New York —
  ["New York", "NY", 40.71, -74.01],
  ["Queens", "NY", 40.73, -73.79],
  ["Flushing", "NY", 40.76, -73.83],
  ["Jackson Heights", "NY", 40.75, -73.88],
  ["Brooklyn", "NY", 40.68, -73.94],
  ["Bronx", "NY", 40.84, -73.87],
  ["Hicksville", "NY", 40.77, -73.53],
  ["New Hyde Park", "NY", 40.73, -73.69],
  ["Yonkers", "NY", 40.93, -73.9],
  ["Buffalo", "NY", 42.89, -78.88],
  ["Rochester", "NY", 43.16, -77.61],
  ["Albany", "NY", 42.65, -73.76],

  // — New England —
  ["Boston", "MA", 42.36, -71.06],
  ["Cambridge", "MA", 42.37, -71.11],
  ["Worcester", "MA", 42.26, -71.8],
  ["Providence", "RI", 41.82, -71.41],
  ["Hartford", "CT", 41.76, -72.67],
  ["Stamford", "CT", 41.05, -73.54],
  ["New Haven", "CT", 41.31, -72.93],

  // — Mid-Atlantic / DMV —
  ["Philadelphia", "PA", 39.95, -75.17],
  ["Pittsburgh", "PA", 40.44, -80.0],
  ["Washington", "DC", 38.9, -77.04],
  ["Ashburn", "VA", 39.04, -77.49],
  ["Herndon", "VA", 38.97, -77.39],
  ["Chantilly", "VA", 38.89, -77.43],
  ["Sterling", "VA", 39.01, -77.43],
  ["Fairfax", "VA", 38.85, -77.31],
  ["Richmond", "VA", 37.54, -77.44],
  ["Rockville", "MD", 39.08, -77.15],
  ["Gaithersburg", "MD", 39.14, -77.2],
  ["Baltimore", "MD", 39.29, -76.61],

  // — Southeast —
  ["Atlanta", "GA", 33.75, -84.39],
  ["Alpharetta", "GA", 34.08, -84.29],
  ["Johns Creek", "GA", 34.03, -84.2],
  ["Charlotte", "NC", 35.23, -80.84],
  ["Cary", "NC", 35.79, -78.78],
  ["Morrisville", "NC", 35.82, -78.83],
  ["Raleigh", "NC", 35.78, -78.64],
  ["Durham", "NC", 35.99, -78.9],
  ["Orlando", "FL", 28.54, -81.38],
  ["Tampa", "FL", 27.95, -82.46],
  ["Miami", "FL", 25.76, -80.19],
  ["Jacksonville", "FL", 30.33, -81.66],
  ["Nashville", "TN", 36.16, -86.78],

  // — Midwest —
  ["Chicago", "IL", 41.88, -87.63],
  ["Naperville", "IL", 41.79, -88.15],
  ["Schaumburg", "IL", 42.03, -88.08],
  ["Skokie", "IL", 42.03, -87.73],
  ["Aurora", "IL", 41.76, -88.32],
  ["Hoffman Estates", "IL", 42.05, -88.13],
  ["Bloomingdale", "IL", 41.96, -88.08],
  ["Detroit", "MI", 42.33, -83.05],
  ["Troy", "MI", 42.6, -83.15],
  ["Novi", "MI", 42.48, -83.48],
  ["Canton", "MI", 42.31, -83.48],
  ["Farmington Hills", "MI", 42.5, -83.38],
  ["Sterling Heights", "MI", 42.58, -83.03],
  ["Ann Arbor", "MI", 42.28, -83.74],
  ["Columbus", "OH", 39.96, -82.99],
  ["Cleveland", "OH", 41.5, -81.69],
  ["Cincinnati", "OH", 39.1, -84.51],
  ["Indianapolis", "IN", 39.77, -86.16],
  ["Minneapolis", "MN", 44.98, -93.27],
  ["Milwaukee", "WI", 43.04, -87.91],
  ["St. Louis", "MO", 38.63, -90.2],
  ["Kansas City", "MO", 39.1, -94.58],

  // — Texas —
  ["Houston", "TX", 29.76, -95.37],
  ["Sugar Land", "TX", 29.62, -95.63],
  ["Katy", "TX", 29.79, -95.82],
  ["Pearland", "TX", 29.56, -95.29],
  ["Dallas", "TX", 32.78, -96.8],
  ["Irving", "TX", 32.81, -96.95],
  ["Plano", "TX", 33.02, -96.7],
  ["Frisco", "TX", 33.15, -96.82],
  ["Richardson", "TX", 32.95, -96.73],
  ["McKinney", "TX", 33.2, -96.62],
  ["Allen", "TX", 33.1, -96.67],
  ["Carrollton", "TX", 32.98, -96.9],
  ["Coppell", "TX", 32.95, -97.01],
  ["Austin", "TX", 30.27, -97.74],
  ["Round Rock", "TX", 30.51, -97.68],
  ["San Antonio", "TX", 29.42, -98.49],

  // — Mountain / Southwest —
  ["Denver", "CO", 39.74, -104.99],
  ["Aurora", "CO", 39.73, -104.83],
  ["Phoenix", "AZ", 33.45, -112.07],
  ["Chandler", "AZ", 33.31, -111.84],
  ["Gilbert", "AZ", 33.35, -111.79],
  ["Tempe", "AZ", 33.43, -111.94],
  ["Las Vegas", "NV", 36.17, -115.14],
  ["Salt Lake City", "UT", 40.76, -111.89],

  // — California: Bay Area —
  ["San Jose", "CA", 37.34, -121.89],
  ["Santa Clara", "CA", 37.35, -121.96],
  ["Sunnyvale", "CA", 37.37, -122.04],
  ["Fremont", "CA", 37.55, -121.99],
  ["Milpitas", "CA", 37.43, -121.9],
  ["Cupertino", "CA", 37.32, -122.03],
  ["Mountain View", "CA", 37.39, -122.08],
  ["San Francisco", "CA", 37.77, -122.42],
  ["Oakland", "CA", 37.8, -122.27],
  ["Pleasanton", "CA", 37.66, -121.87],
  ["Dublin", "CA", 37.7, -121.94],
  ["San Ramon", "CA", 37.78, -121.98],
  ["Sacramento", "CA", 38.58, -121.49],
  ["Elk Grove", "CA", 38.41, -121.37],

  // — California: SoCal & Central —
  ["Los Angeles", "CA", 34.05, -118.24],
  ["Artesia", "CA", 33.87, -118.08],
  ["Cerritos", "CA", 33.86, -118.06],
  ["Irvine", "CA", 33.68, -117.83],
  ["Anaheim", "CA", 33.84, -117.91],
  ["Riverside", "CA", 33.95, -117.4],
  ["San Diego", "CA", 32.72, -117.16],
  ["Fresno", "CA", 36.74, -119.77],
  ["Bakersfield", "CA", 35.37, -119.02],

  // — Pacific Northwest —
  ["Seattle", "WA", 47.61, -122.33],
  ["Bellevue", "WA", 47.61, -122.2],
  ["Redmond", "WA", 47.67, -122.12],
  ["Bothell", "WA", 47.76, -122.21],
  ["Sammamish", "WA", 47.62, -122.04],
  ["Renton", "WA", 47.48, -122.21],
  ["Portland", "OR", 45.51, -122.68],
  ["Hillsboro", "OR", 45.52, -122.99],
];

export const CITIES: City[] = ROWS.map(([name, state, lat, lng]) => ({ name, state, lat, lng }));
