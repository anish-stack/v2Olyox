const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const RiderSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    rideVehicleInfo: {
        vehicleName: {
            type: String,
            required: true
        },
        vehicleType: {
            type: String
        },
        PricePerKm: {
            type: Number

        },
        RcExpireDate: {
            type: String
        },
        VehicleNumber: {
            type: String,
            required: true,
        },
        VehicleImage: [String]

    },
    aadharNumber:{
        type:String,
    },
    isFirstRechargeDone: {
        type: Boolean,
        default: false
    },
    isProfileComplete: {
        type: Boolean,
        default: false
    },
    isDocumentUpload: {
        type: Boolean,
        default: false
    },
    TotalRides: {
        type: Number,
        default: 0
    },
    rides: [{
        type: Schema.Types.ObjectId,
        ref: 'RideRequest'
    }],
    Ratings: {
        type: Number,
        default: 0

    },
    documents: {
        license: {
            type: String,

        },
        rc: {
            type: String,
        },
        insurance: {
            type: String,
        },
        aadharBack: {
            type: String
        },
        aadharFront: {
            type: String
        },
        pancard: {
            type: String
        },
        profile: {
            type: String
        }

    },
    isPaid: {
        type: Boolean,
        default: false
    },
    RechargeData: {
        rechargePlan: String,
        expireData: Date,
        onHowManyEarning: {
            type:String,
            default:'Ops'
        },
        whichDateRecharge:Date,
        approveRecharge: Boolean
    },
    lastNotificationSent: {
        type: Date,
        default: null,
    },

    Bh: {
        type: String
    },
    DocumentVerify: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isFreeMember: {
        type: Boolean,
        default: false
    },
    freeTierEndData: {
        type: Date,
        default: null
    },
    amountPaid: {
        type: Number,
        default: 0
    },
    trn_no: {
        type: String
    },
    payment_status: {
        type: String
    },
    payment_date: {
        type: Date
    },
    her_referenced: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ParcelBikeRegister'
    }],
    isOtpBlock: {
        type: Boolean,
        default: false
    },
    howManyTimesHitResend: {
        type: Number,
        default: 0
    },
    otpUnblockAfterThisTime: {
        type: Date,

    },
    isOtpVerify: {
        type: Boolean,
        default: false
    },
    otp: {
        type: String
    },
    phone: {
        type: String,
        required: true
    },
    address: {
        type: String,
        // required: true
    },
    isAvailable: {
        type: Boolean,
        default: false
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            // required: true
        },
        coordinates: {
            type: [Number],
            // required: true
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    BH: {
        type: String
    },
    on_ride_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TempRideDetails'
    },
    YourQrCodeToMakeOnline: {
        type: String,
        default: null

    },
    JsonData: {
        type: Object
    },
    ridesRejected: {
        type: Number,
        default: 0
    },
    recentRejections: [{
        rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'RideRequest' },
        timestamp: { type: Date, default: Date.now }
    }],

    category: {
        type: String,
        enum: ["parcel", "cab"],
        default: "cab"
    },

    isBlockByAdmin: {
        type: Boolean,
        default: false
    }
});

RiderSchema.index({ location: '2dsphere' });
RiderSchema.index({ 'rideVehicleInfo.VehicleNumber': 1 });

module.exports = mongoose.model('Rider', RiderSchema);
