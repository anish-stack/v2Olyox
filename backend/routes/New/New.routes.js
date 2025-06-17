
const express = require('express');
const { NewcreateRequest, ride_status_after_booking, riderFetchPoolingForNewRides, riderActionAcceptOrRejectRide, ride_status_after_booking_for_drivers } = require('../../src/New-Rides-Controller/CreateNewRides');
const Protect = require('../../middleware/Auth');
const { calculateRidePriceForUser } = require('../../src/New-Rides-Controller/FindPrice');
const NewRoutes = express.Router()

NewRoutes.post('/new-ride', Protect, NewcreateRequest)
NewRoutes.post('/new-price-calculations', calculateRidePriceForUser)
NewRoutes.get('/status/:rideId', Protect, ride_status_after_booking)




NewRoutes.get('/pooling-rides-for-rider', riderFetchPoolingForNewRides)
NewRoutes.post('/ride-action-reject-accepet', riderActionAcceptOrRejectRide)
NewRoutes.get('/status-driver/:rideId', ride_status_after_booking_for_drivers)


module.exports = NewRoutes;