import { css } from '../utils/css';

/** Visually hidden SEO copy kept from the original page. */
export default function SeoContent() {
  return (
    <>
      <div className="sr-only" style={css('position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;')}>
        <h2>Kakkson Hotels - Best Hotel in Patia, Bhubaneswar</h2>
        <p>Kakkson Hotels offers comfortable and affordable accommodation in Patia, Bhubaneswar. Our hotel is conveniently located near KIIT University, making it an ideal choice for students, parents, and business travelers.</p>

        <h3>Why Choose Kakkson Hotels?</h3>
        <ul>
          <li>Prime location in Patia, close to KIIT and major IT parks</li>
          <li>Modern, clean rooms with air conditioning and free WiFi</li>
          <li>Affordable rates with flexible meal plans (Room Only or Breakfast Included)</li>
          <li>24-hour front desk and secure online booking system</li>
          <li>Easy access to Bhubaneswar city center and transportation hubs</li>
        </ul>

        <h3>Our Rooms</h3>
        <p>We offer a variety of room types to suit different needs, including standard rooms, deluxe rooms, and suites. All rooms come with attached bathrooms, comfortable beds, and modern amenities.</p>

        <h3>Location Benefits</h3>
        <p>Located in Patia, Bhubaneswar, our hotel provides easy access to:</p>
        <ul>
          <li>KIIT University - Just minutes away</li>
          <li>Bhubaneswar Railway Station - 10 km</li>
          <li>Biju Patnaik International Airport - 12 km</li>
          <li>Infocity and IT Parks - Close proximity</li>
          <li>Nandankanan Zoological Park - 15 km</li>
        </ul>

        <h3>Book Your Stay</h3>
        <p>Use our secure online booking system to check room availability, compare rates, and reserve your room instantly. We offer the best price guarantee for direct bookings.</p>
      </div>

      <div style={css('display: none;')} aria-hidden="true">
        <div itemScope itemType="https://schema.org/Hotel">
          <span itemProp="name">Kakkson Hotels</span>
          <span itemProp="address" itemScope itemType="https://schema.org/PostalAddress">
            <span itemProp="addressLocality">Patia, Bhubaneswar</span>
            <span itemProp="addressRegion">Odisha</span>
            <span itemProp="addressCountry">India</span>
          </span>
          <span itemProp="priceRange">₹1,500 - ₹4,000</span>
        </div>

        <h3>Areas We Serve</h3>
        <ul>
          <li>Hotels in Patia, Bhubaneswar</li>
          <li>Hotels in Balipanda, Puri</li>
          <li>Hotels in Swargadwar, Puri</li>
          <li>Hotels near KIIT University</li>
          <li>Hotels near Infocity, Bhubaneswar</li>
        </ul>
      </div>
    </>
  );
}
