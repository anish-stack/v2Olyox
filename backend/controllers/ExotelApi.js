const rideRequestModel = require("../models/ride.request.model");
const User = require('../models/normal_user/User.model');
const RiderModel = require("../models/Rider.model");
const Parcel_Request = require("../models/Parcel_Models/Parcel_Request");

exports.webhookExotelApi = async (req, res) => {
    try {
        console.log('Webhook triggered: Incoming request', req.query);
        
        const { CallFrom } = req.query;
        if (!CallFrom) {
            console.log('Error: Missing CallFrom parameter in request');
            return res.status(400).type('text/plain').send('Invalid Request');
        }
        
        const removeZero = CallFrom.replace(/^0+/, '');
        console.log('Processed CallFrom after removing leading zeros:', removeZero);
        
        let typeOfCall = 'user-to-rider';
        let checkThisWithOurUser;
        
        console.log('Checking if caller is a registered user...');
        // Check if the call is from a user or a rider
        checkThisWithOurUser = await User.findOne({ number: removeZero });
        console.log('User lookup result:', checkThisWithOurUser ? `Found user with ID ${checkThisWithOurUser._id}` : 'No user found');
        
        if (!checkThisWithOurUser) {
            console.log('No user found, checking if caller is a registered rider...');
            // If no user found, check for rider
            checkThisWithOurUser = await RiderModel.findOne({ phone: removeZero });
            console.log('Rider lookup result:', checkThisWithOurUser ? `Found rider with ID ${checkThisWithOurUser._id}` : 'No rider found');
            
            if (checkThisWithOurUser) {
                typeOfCall = 'rider-to-user';
                console.log('Call type set to: rider-to-user');
            } else {
                // Neither user nor rider found with this number
                console.log(`No user or rider found with number: ${removeZero}. Returning empty response.`);
                return res.status(200).type('text/plain').send('');
            }
        } else {
            console.log('Call type set to: user-to-rider');
        }
        
        if (typeOfCall === 'user-to-rider') {
            console.log(`Processing user-to-rider call from user ID: ${checkThisWithOurUser._id}`);
            // Check if it's a user calling and link to current ride
            console.log('Looking for active or completed ride associated with this user...');
            const rideRequest = await rideRequestModel
                .findOne({ user: checkThisWithOurUser._id, rideStatus: { $in: ['active', 'completed'] } })
                .populate('rider', 'phone')
                .sort({ createdAt: -1 });
            
            console.log('Active/completed ride lookup result:', rideRequest ? 'Ride found' : 'No active ride found');
            
            if (rideRequest && rideRequest.rider && rideRequest.rider.phone) {
                console.log(`Found active ride with rider. Rider phone: ${rideRequest.rider.phone}`);
                const riderPhone = rideRequest.rider.phone;
              
                const formattedPhone = riderPhone.startsWith('+') ? riderPhone : `+91${riderPhone}`;
                console.log(`Returning formatted rider phone: ${formattedPhone}`);
                return res.status(200).type('text/plain').send(formattedPhone);
            }
            
            // If no active ride, check for parcel
            console.log('No active ride found. Looking for parcel delivery associated with this user...');
            const userParcelDetails = await Parcel_Request
                .findOne({ customerId: checkThisWithOurUser._id,  })
                .populate('rider_id', 'phone')
                .sort({ createdAt: -1 });
            
            console.log('Parcel lookup result:', userParcelDetails ? 'Parcel found' : 'No active parcel found');
                
            if (userParcelDetails && userParcelDetails.rider_id && userParcelDetails.rider_id.phone) {
                console.log(`Found active parcel with rider. Rider phone: ${userParcelDetails.rider_id.phone}`);
                const riderPhone = userParcelDetails.rider_id.phone;
                const formattedPhone = riderPhone.startsWith('+') ? riderPhone : `+91${riderPhone}`;
                console.log(`Returning formatted rider phone for parcel: ${formattedPhone}`);
                return res.status(200).type('text/plain').send(formattedPhone);
            }
            
            console.log(`No active ride or parcel found for user ID ${checkThisWithOurUser._id}. Returning empty response.`);
            return res.status(200).type('text/plain').send('');
        }
        
        if (typeOfCall === 'rider-to-user') {
            console.log(`Processing rider-to-user call from rider ID: ${checkThisWithOurUser._id}`);
            // Check if it's a rider calling and link to current ride
            console.log('Looking for active or completed ride associated with this rider...');
            const rideDetails = await rideRequestModel
                .findOne({ rider: checkThisWithOurUser._id, rideStatus: { $in: ['active', 'completed'] } })
                .populate('user', 'number')
                .sort({ createdAt: -1 });
            
            console.log('Active/completed ride lookup result:', rideDetails ? 'Ride found' : 'No active ride found');
            
            if (rideDetails && rideDetails.user && rideDetails.user.number) {
                console.log(`Found active ride with user. User phone: ${rideDetails.user.number}`);
                const userPhone = rideDetails.user.number;
                const formattedPhone = userPhone.startsWith('+') ? userPhone : `+91${userPhone}`;
                console.log(`Returning formatted user phone: ${formattedPhone}`);
                return res.status(200).type('text/plain').send(formattedPhone);
            }
            
            // If no active ride, check for parcel
            console.log('No active ride found. Looking for parcel delivery associated with this rider...',checkThisWithOurUser?._id);
            const parcelDetails = await Parcel_Request
                .findOne({ rider_id: checkThisWithOurUser._id })
                .populate('customerId', 'number')
                .sort({ createdAt: -1 });
            
            console.log('Parcel lookup result:', parcelDetails ? 'Parcel found' : 'No active parcel found');
            
            if (parcelDetails && parcelDetails.customerId && parcelDetails.customerId.number) {
                console.log(`Found active parcel with user. User phone: ${parcelDetails.customerId.number}`);
                const userPhone = parcelDetails.customerId.number;
                const formattedPhone = userPhone.startsWith('+') ? userPhone : `+91${userPhone}`;
                console.log(`Returning formatted user phone for parcel: ${formattedPhone}`);
                return res.status(200).type('text/plain').send(formattedPhone);
            }
            
            console.log(`No active ride or parcel found for rider ID ${checkThisWithOurUser._id}. Returning empty response.`);
            return res.status(200).type('text/plain').send('');
        }
        
        console.log('Warning: Reached end of function without hitting a return statement');
        return res.status(200).type('text/plain').send('');
        
    } catch (error) {
        console.error('Error processing the webhook request:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).type('text/plain').send('Internal Server Error');
    }
};