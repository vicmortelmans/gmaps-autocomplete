var geocoder;
var map;
var layer;
var layer2;
var marker;

// initialise the google maps objects, and add listeners
function gmaps_init() {

    // center of the universe
    var latlng = new google.maps.LatLng(51.2205424,4.4224811);

    var options = {
        zoom: 17,
        center: latlng,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    // create our map object
    map = new google.maps.Map(document.getElementById("gmaps-canvas"), options);

    // create the fusion table layer containing predefined locations
    layer = new google.maps.FusionTablesLayer({
        map: map,
        query: {
            select: 'latitude',
            from: '1fBsPig_-ZvkrxAz1pGArRQhqOLEQGCafJbY_z5w2'  // table must be shared !!
        },
        styles: [{
            markerOptions: {
               iconName: "small_green"
            }
        }],
        options: {
            styleId: 2,
            templateId: 2,
            suppressInfoWindows: true
        }
    });
    
    // create the fusion table layer containing current locations
    layer2 = new google.maps.FusionTablesLayer({
        map: map,
        query: {
            select: 'latitude',
            from: '1hpPoQWl-G6e6FjagnqOZ2pAicWOAC9x7txR1mXk'  // table must be shared !!
        }, // when adding a second layer, keep in mind that only one layer can be styled!!!
        options: {
            styleId: 2,
            templateId: 2,
            suppressInfoWindows: true
        }
    });
    
    // the geocoder object allows us to do latlng lookup based on address
    geocoder = new google.maps.Geocoder();

    // the marker shows us the position of the latest address
    marker = new google.maps.Marker({
        map: map,
        draggable: true
    });

    // event triggered when marker is dragged and dropped
    google.maps.event.addListener(marker, 'dragend', function() {
        geocode_lookup('latLng', marker.getPosition());
    });

    // event triggered when map is clicked
    google.maps.event.addListener(map, 'click', function(event) {
        marker.setPosition(event.latLng)
        geocode_lookup('latLng', event.latLng);
    });

    $('#gmaps-error').hide();

    // Retrieve address from InfoWindow ('balloon')
    // code copied from http://stackoverflow.com/a/21488643/591336

    //store the original setContent-function
    var original_setContent = google.maps.InfoWindow.prototype.setContent;

    //override the built-in setContent-method
    google.maps.InfoWindow.prototype.setContent = function(content) {
        //when argument is a node
        if (content.querySelector) {
            //search for the address
            var addr = content.querySelector('.gm-basicinfo .gm-addr');
            var name = content.querySelector('.gm-title');
            if (addr && this.logAsInternal) {
                google.maps.event.addListenerOnce(this, 'map_changed', function() {
                    var map = this.getMap();
                    var position = this.getPosition();
                    if (map) {
                        marker.setPosition(position)
                        // pass through geocode to fetch postal code
                        geocoder.geocode({latLng: position}, function(results, status) {
                            if (status == google.maps.GeocoderStatus.OK) {
                                // Google geocoding has succeeded!
                                if (results[0]) {
                                    // Always update the UI elements with new location data
                                    update_ui({
                                        address: addr.textContent, 
                                        postal_code: get_postal_code(results[0]),
                                        name: name.textContent, 
                                        location: position
                                    });
                                    return;
                                }
                            }
                            // Geocoder status ok but no results!? or status not ok
                            update_ui({
                                address: addr.textContent, 
                                postal_code: '',
                                name: name.textContent, 
                                location: position
                            });
                            return;
                        });
                    }
                });
            }
            else {
                //run the original setContent-method
                original_setContent.apply(this, arguments);
            };
        };
    };
    
    google.maps.event.addListener(layer, 'click', function(e) {
        var position = new google.maps.LatLng(e.row.latitude.value, e.row.longitude.value);
        var name = e.row.name.value;
        geocoder.geocode({latLng: position}, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
                // Google geocoding has succeeded!
                if (results[0]) {
                    // Always update the UI elements with new location data
                    update_ui({
                        address: '', 
                        postal_code: get_postal_code(results[0]),
                        name: name, 
                        location: position
                    });
                    return;
                }
            }
            // Geocoder status ok but no results!? or status not ok
            update_ui({
                address: '', 
                postal_code: '',
                name: name, 
                location: position
            });
            return;
        });
    });

    google.maps.event.addListener(layer2, 'click', function(e) {
        var address = e.row['address'].value;
        var postal_code = e.row['postal code'].value;
        var position = new google.maps.LatLng(e.row.latitude.value, e.row.longitude.value);
        var name = e.row['location name'].value;
        update_ui({
            address: address,
            postal_code: postal_code,
            name: name, 
            location: position
        });
    });

}

// move the marker to a new position, and center the map on it
function update_map(geometry) {
    map.fitBounds(geometry.viewport)
    marker.setPosition(geometry.location)
}

// fill in the UI elements with new position data
function update_ui(data) {
    var address = data.address;
    var name = data.name;
    var latLng = data.location;
    var postal_code = data.postal_code;
    $('#gmaps-input-address').autocomplete("close");
    $('#gmaps-input-address').val(address);
    $('#gmaps-output-name').val(name);
    $('#gmaps-output-latitude').html(latLng.lat());
    $('#gmaps-output-longitude').html(latLng.lng());
    $('#gmaps-output-postal-code').html(postal_code);
}

// Query the Google geocode object
//
// type: 'address' for search by address
//       'latLng'  for search by latLng (reverse lookup)
//
// value: search query
//
// update: should we update the map (center map and position marker)?
function geocode_lookup(type, value, update) {
    // default value: update = false
    update = typeof update !== 'undefined' ? update : false;

    request = {};
    request[type] = value;

    geocoder.geocode(request, function(results, status) {
        $('#gmaps-error').html('');
        $('#gmaps-error').hide();
        if (status == google.maps.GeocoderStatus.OK) {
            // Google geocoding has succeeded!
            if (results[0]) {
                // Always update the UI elements with new location data
                update_ui({
                    address: results[0].formatted_address,
                    postal_code: get_postal_code(results[0]),
                    name: '', 
                    location: results[0].geometry.location
                });

                // Only update the map (position marker and center map) if requested
                if (update) {
                    update_map(results[0].geometry);
                }
            }
            else {
                // Geocoder status ok but no results!?
                $('#gmaps-error').html("Sorry, something went wrong. Try again!");
                $('#gmaps-error').show();
            }
        }
        else {
            // Google Geocoding has failed. Two common reasons:
            //   * Address not recognised (e.g. search for 'zxxzcxczxcx')
            //   * Location doesn't map to address (e.g. click in middle of Atlantic)

            if (type == 'address') {
                // User has typed in an address which we can't geocode to a location
                $('#gmaps-error').html("Sorry! We couldn't find " + value + ". Try a different search term, or click the map.");
                $('#gmaps-error').show();
            }
            else {
                // User has clicked or dragged marker to somewhere that Google can't do a reverse lookup for
                // In this case we display a warning, clear the address box, but fill in LatLng
                $('#gmaps-error').html("Woah... that's pretty remote! You're going to have to manually enter a place name.");
                $('#gmaps-error').show();
                update_ui({
                    address: '',
                    postal_code: '',
                    name: '',
                    location: value
                })
            }
        };
    });
}

// initialise the jqueryUI autocomplete element
function autocomplete_init() {
    $("#gmaps-input-address").autocomplete({

        // source is the list of input options shown in the autocomplete dropdown.
        // see documentation: http://jqueryui.com/demos/autocomplete/
        source: function(request, response) {

            // the geocode method takes an address or LatLng to search for
            // and a callback function which should process the results into
            // a format accepted by jqueryUI autocomplete
            geocoder.geocode({
                'address': request.term
            }, function(results, status) {
                response($.map(results, function(item) {
                    return {
                        label: item.formatted_address, // appears in dropdown box
                        value: item.formatted_address, // inserted into input element when selected
                        geocode: item // all geocode data: used in select callback event
                    };
                }));
            });
        },

        // event triggered when drop-down option selected
        select: function(event, ui) {
            update_ui({
                address: ui.item.value,
                postal_code: get_postal_code(ui.item.geocode),
                name: '',
                location: ui.item.geocode.geometry.location
            });
            update_map(ui.item.geocode.geometry);
        }
    });

    // triggered when user presses a key in the address box
    $("#gmaps-input-address").bind('keydown', function(event) {
        if (event.keyCode == 13) {
            geocode_lookup('address', $('#gmaps-input-address').val(), true);

            // ensures dropdown disappears when enter is pressed
            $('#gmaps-input-address').autocomplete("disable");
        }
        else {
            // re-enable if previously disabled above
            $('#gmaps-input-address').autocomplete("enable");
        }
    });
} // autocomplete_init

function get_postal_code(res) {
    var zip = "";
	for (var i = 0; i < res.address_components.length; i++) {
		if (res.address_components[i].types[0] == "postal_code") {
			zip = res.address_components[i].short_name;
		}
	}
	return zip;
}

$(document).ready(function() {
    if ($('#gmaps-canvas').length) {
        gmaps_init();
        autocomplete_init();
    };
});
