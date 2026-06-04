<?php
/**
 * Plugin snippet: embed Coastal booking React app on any page.
 * Upload frontend/dist to wp-content/uploads/coastal-booking/
 */
function coastal_booking_shortcode() {
    $base = content_url('/uploads/coastal-booking/');
    return sprintf(
        '<div id="root"></div>
        <link rel="stylesheet" href="%1$sassets/index.css" />
        <script type="module" src="%1$sassets/index.js"></script>',
        esc_url(trailingslashit($base))
    );
}
add_shortcode('coastal_booking', 'coastal_booking_shortcode');
