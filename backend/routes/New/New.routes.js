
const express = require('express');
const { NewcreateRequest, ride_status_after_booking } = require('../../src/New-Rides-Controller/CreateNewRides');
const Protect = require('../../middleware/Auth');
const { calculateRidePriceForUser } = require('../../src/New-Rides-Controller/FindPrice');
const NewRoutes = express.Router()

NewRoutes.post('/new-ride', Protect, NewcreateRequest)
NewRoutes.post('/new-price-calculations', calculateRidePriceForUser)
NewRoutes.get('/status/:rideId', Protect, ride_status_after_booking)


module.exports = NewRoutes;