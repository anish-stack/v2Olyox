const CabRiderTimes = require("../models/CabRiderTimes");
const rideRequestModel = require("../models/ride.request.model");
const Rider = require("../models/Rider.model");
const generateOtp = require("../utils/Otp.Genreator");
const send_token = require("../utils/send_token");
const SendWhatsAppMessage = require("../utils/whatsapp_send");
const axios = require("axios");
const cloudinary = require("cloudinary").v2;
const moment = require("moment");
const momentTz = require("moment-timezone");

const fs = require("fs");
const path = require("path");

const Bonus_Model = require("../models/Bonus_Model/Bonus_Model");
const Parcel_Request = require("../models/Parcel_Models/Parcel_Request");
const { sendDltMessage } = require("../utils/DltMessageSend");
const { checkBhAndDoRechargeOnApp } = require("../PaymentWithWebDb/razarpay");
cloudinary.config({
  cloud_name: "daxbcusb5",
  api_key: "984861767987573",
  api_secret: "tCBu9JNxC_iaUENm1kDwLrdXL0k",
});
// Register a new rider
exports.registerRider = async (req, res) => {
  try {
    const { name, phone, rideVehicleInfo, BH, role, aadharNumber } = req.body;
    const {
      vehicleName,
      vehicleType,
      PricePerKm,
      VehicleNumber,
      RcExpireDate,
    } = rideVehicleInfo;

    // Validate input
    if (!BH)
      return res
        .status(400)
        .json({ success: false, message: "Please enter your BH Number." });
    if (!name || !phone || !vehicleName || !vehicleType || !VehicleNumber)
      return res
        .status(400)
        .json({
          success: false,
          message: "All required fields must be filled.",
        });

    // Check if BH number already exists
    const bhExists = await Rider.findOne({ BH });
    if (bhExists) {
      return res.status(400).json({
        success: false,
        message: `A rider is already registered with BH Number: ${BH}. Please use a different BH Number.`,
      });
    }

    // Check if phone number is already registered
    let existingRider = await Rider.findOne({ phone });

    if (existingRider) {
      if (!existingRider.isOtpVerify) {
        if (existingRider.howManyTimesHitResend >= 5) {
          existingRider.isOtpBlock = true;
          existingRider.isDocumentUpload = false;
          existingRider.otpUnblockAfterThisTime = new Date(
            Date.now() + 30 * 60 * 1000
          ); // 30 mins block
          await existingRider.save();

          await SendWhatsAppMessage(
            `Hi ${existingRider.name || "User"
            },\n\nYou’ve attempted OTP verification too many times.\nYour account has been temporarily locked for 30 minutes. Please try again later.\n\n- Team Olyox`,
            phone
          );

          return res.status(429).json({
            success: false,
            message: "Too many OTP attempts. You are blocked for 30 minutes.",
          });
        }

        // Resend OTP
        const otp = generateOtp();
        existingRider.otp = otp;
        existingRider.howManyTimesHitResend += 1;
        existingRider.isDocumentUpload = false;
        await existingRider.save();

        await SendWhatsAppMessage(
          `Hi ${existingRider.name || "User"
          },\n\nYour OTP for registering as ${role} rider is: ${otp}\n\nPlease use this to complete your registration.\n\n- Team Olyox`,
          phone
        );

        return res.status(200).json({
          success: true,
          message: `OTP resent. Please verify to continue registration.`,
        });
      }

      return res.status(409).json({
        success: false,
        message: `Phone number already registered with a verified account.`,
      });
    }

    // Check if Aadhar already exists
    const existingAadhar = await Rider.findOne({ aadharNumber });
    if (existingAadhar) {
      return res.status(409).json({
        success: false,
        message: `Aadhar number already exists. Please use a different Aadhar or log in if it's your account.`,
      });
    }

    // Check if vehicle number is already registered
    const existingVehicle = await Rider.findOne({
      "rideVehicleInfo.VehicleNumber": VehicleNumber,
    });
    if (existingVehicle) {
      return res.status(409).json({
        success: false,
        message: `Vehicle number ${VehicleNumber} is already registered with another rider.`,
      });
    }

    // Create new rider with OTP
    const otp = generateOtp();
    const newRider = new Rider({
      name,
      phone,
      rideVehicleInfo: {
        vehicleName,
        vehicleType,
        PricePerKm,
        VehicleNumber,
        RcExpireDate,
      },
      BH,
      category: role,
      aadharNumber,
      otp,
      isOtpVerify: false,
      isDocumentUpload: false,
      howManyTimesHitResend: 0,
      isOtpBlock: false,
    });

    const savedRider = await newRider.save();

    // Send OTP via WhatsApp
    const message = `Hi ${name},\n\nWelcome to Olyox!\nYour OTP for registering as a ${role} rider is: ${otp}.\n\nPlease verify your OTP to complete your registration.\n\nThank you for choosing us!\n- Team Olyox`;
    await SendWhatsAppMessage(message, phone);

    return res.status(201).json({
      success: true,
      message: "Rider registration initiated. OTP sent successfully.",
      rider: savedRider,
    });
  } catch (error) {
    console.error("Error registering rider:", error);
    return res.status(500).json({
      success: false,
      message:
        "Something went wrong during registration. Please try again later.",
    });
  }
};

exports.getSingleRider = async (req, res) => {
  try {
  } catch (error) {
    console.log("Internal server error", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
exports.updateRechargeDetails = async (req, res) => {
  try {
    const { rechargePlan, expireData, approveRecharge, BH } = req.body || {};

    console.log("Request body:", req.body);

    // Validate required fields
    if (!BH) {
      return res
        .status(400)
        .json({ success: false, message: "BH is required" });
    }

    // Find the rider by BH
    const foundRider = await Rider.findOne({ BH });
    if (!foundRider) {
      return res
        .status(404)
        .json({ success: false, message: "Rider not found" });
    }

    // If approveRecharge is true, update the recharge details
    if (approveRecharge) {
      foundRider.RechargeData = {
        rechargePlan,
        expireData,
        approveRecharge: true,
      };
      foundRider.isPaid = true;

      await foundRider.save();

      return res.status(200).json({
        success: true,
        message: "Recharge approved and rider marked as paid.",
        data: foundRider,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Recharge approval is required.",
      });
    }
  } catch (error) {
    console.error("Error updating recharge details:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};

exports.login = async (req, res) => {
  try {
    const { number, otpType } = req.body;
    console.log("otpType", otpType);

    if (!number) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const partner = await Rider.findOne({ phone: number });

    if (!partner) {
      try {
        const response = await axios.post(
          `https://www.webapi.olyox.com/api/v1/getProviderDetailsByNumber`,
          {
            number: number,
          }
        );
        if (response.data.success) {
          return res.status(403).json({
            success: false,
            message:
              "You are  registered with us on website But on vendor Complete Profile First !!",
            redirect: "complete-profile",
          });
        } else {
          console.log(response.data);
        }
      } catch (error) {
        console.log(error.response.data);
        return res.status(402).json({
          success: false,
          message:
            "Profile is not be found on website and app please register first !!! ",
        });
      }
    }

    if (partner.isBlockByAdmin) {
      return res.status(401).json({
        success: false,
        message: "Your Account Has been Blocked By Admin Contact Support !!",
      });
    }

    // Check if the user is blocked for OTP
    if (partner.isOtpBlock) {
      // Check the time when OTP should be unblocked
      const currentTime = new Date();
      const unblockTime = new Date(partner.otpUnblockAfterThisTime);

      // If the unblock time has not passed yet, notify the user
      if (currentTime < unblockTime) {
        return res.status(403).json({
          success: false,
          message: `You are blocked from requesting OTP. Please try again after ${unblockTime.toLocaleTimeString()}`,
        });
      }

      // If unblock time has passed, unblock the user
      partner.isOtpBlock = false;
      partner.otpUnblockAfterThisTime = null; // Clear unblock time
      partner.howManyTimesHitResend = 0; // Reset resend attempts
      await partner.save();
    }

    // Generate OTP if the user is not blocked
    const otp = await generateOtp();
    partner.otp = otp;
    await partner.save();

    if (otpType === "text") {
      await sendDltMessage(otp, number);
    } else {
      const otpMessage = `Your OTP for CaB registration is: ${otp}`;
      await SendWhatsAppMessage(otpMessage, number);
    }

    res.status(201).json({
      success: true,
      message: "Please verify OTP sent to your phone.",
      otp: otp,
    });
  } catch (error) {
    res.status(501).json({
      success: false,
      error: error.message || "Something went wrong",
    });
  }
};

exports.logoutRider = async (req, res) => {
  try {
    const { rider_id } = req.params || {};

    const foundRider = await Rider.findById(rider_id);
    if (!foundRider) {
      return res.status(401).json({
        success: false,
        message: "Please log in to access this feature.",
      });
    }

    // Prevent logout if there's an active ride
    if (foundRider.on_ride_id) {
      return res.status(402).json({
        success: false,
        message:
          "You currently have an ongoing ride. Please complete the ride before logging out.",
      });
    }

    // Update rider status
    foundRider.isAvailable = false;
    foundRider.on_ride_id = null;
    await foundRider.save(); // important to persist the changes

    // Clear authentication token
    res.clearCookie("auth_token", {
      httpOnly: true,
      secure: true, // set to true in production
      sameSite: "None",
    });

    return res.status(200).json({
      success: true,
      message: "You have been logged out successfully. See you next time!",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message:
        "Oops! Something went wrong while logging out. Please try again later.",
    });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const { number } = req.body;

    if (!number) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const partner = await Rider.findOne({ phone: number });

    if (!partner) {
      return res.status(400).json({
        success: false,
        message: "Phone number is not registered",
      });
    }
    if (partner.isOtpVerify) {
      return res.status(400).json({
        success: false,
        message: "You have already verified your OTP",
      });
    }

    // Check if OTP is blocked
    if (partner.isOtpBlock) {
      // Check if the unblock time has passed
      const currentTime = new Date();
      if (currentTime < partner.otpUnblockAfterThisTime) {
        const timeRemaining =
          (partner.otpUnblockAfterThisTime - currentTime) / 1000;
        return res.status(400).json({
          success: false,
          message: `OTP resend is blocked. Try again in ${Math.ceil(
            timeRemaining
          )} seconds.`,
        });
      } else {
        // Unblock the OTP after the set time has passed
        partner.isOtpBlock = false;
        partner.howManyTimesHitResend = 0; // Reset the resend attempts
        partner.otpUnblockAfterThisTime = null; // Clear the unblock time
        await partner.save();
      }
    }

    // If resend limit is reached, block the OTP and set the unblock time
    if (partner.howManyTimesHitResend >= 5) {
      // Block the OTP and set the time for when it will be unblocked (e.g., 30 minutes)
      partner.isOtpBlock = true;
      partner.otpUnblockAfterThisTime = new Date(Date.now() + 30 * 60 * 1000); // Block for 30 minutes
      await partner.save();

      return res.status(400).json({
        success: false,
        message: "OTP resend limit reached. Please try again later.",
      });
    }

    const otp = await generateOtp();
    partner.otp = otp;
    partner.howManyTimesHitResend += 1;
    await partner.save();

    const otpMessage = `Your OTP for cab registration is: ${otp}`;
    const data = await SendWhatsAppMessage(otpMessage, number);
    console.log(data);
    res.status(200).json({
      success: true,
      message: "OTP resent successfully. Please check your phone.",
      otp: otp,
    });
  } catch (error) {
    res.status(501).json({
      success: false,
      error: error.message || "Something went wrong",
    });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { number, otp } = req.body;

    if (!number || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required",
      });
    }

    const partner = await Rider.findOne({ phone: number });

    if (!partner) {
      return res.status(400).json({
        success: false,
        message: "Phone number is not registered",
      });
    }

    // Check if OTP is valid
    if (partner.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // ✅ Clear OTP and update verification status
    partner.otp = null;
    partner.isOtpVerify = true;
    partner.howManyTimesHitResend = 0;
    partner.isOtpBlock = false;
    partner.otpUnblockAfterThisTime = null;

    console.log("✅ OTP verified for number:", partner.phone);

    // ✅ Try fetching recharge details ONLY if not already paid
    if (!partner.isPaid) {
      console.log("ℹ️ Partner is not paid, attempting to fetch recharge data...");

      try {
        const { success, payment_id, member_id } = await checkBhAndDoRechargeOnApp({ number: partner.phone });

        console.log("✅ Recharge API response:", { success, payment_id, member_id });

        if (
          success &&
          payment_id?.end_date &&
          member_id?.title &&
          member_id?.HowManyMoneyEarnThisPlan !== undefined &&
          payment_id?.createdAt &&
          typeof payment_id?.payment_approved !== 'undefined'
        ) {
          partner.RechargeData = {
            rechargePlan: member_id.title,
            expireData: payment_id.end_date,
            onHowManyEarning: member_id.HowManyMoneyEarnThisPlan,
            whichDateRecharge: payment_id.createdAt,
            approveRecharge: payment_id.payment_approved,
          };
          partner.isPaid = true;

          console.log("✅ Recharge data saved for partner:", partner.phone);
        } else {
          console.log("⚠️ Recharge data incomplete or invalid, not updating RechargeData.");
        }
      } catch (rechargeErr) {
        console.error("❌ Recharge Fetch Failed:", rechargeErr.message);
        // Don't update RechargeData on failure
      }
    } else {
      console.log("ℹ️ Partner is already paid, skipping recharge fetch.");
    }

    // ✅ Save partner
    await partner.save();
    console.log("✅ Partner data saved successfully:", partner);

    // ✅ Send token
    await send_token(partner, { type: "CAB" }, res, req);

  } catch (error) {
    console.error("❌ OTP Verification Error:", error.message);
    res.status(501).json({
      success: false,
      error: error.message || "Something went wrong",
    });
  }
};



// Get all riders
exports.getAllRiders = async (req, res) => {
  try {
    const riders = await Rider.find();
    res.status(200).json(riders);
  } catch (error) {
    console.error("Error fetching riders:", error);
    res.status(500).json({ error: "Failed to fetch riders" });
  }
};

exports.riderDocumentsVerify = async (req, res) => {
  try {
    const { id } = req.params;
    const { DocumentVerify } = req.body;
    const rider = await Rider.findById(id);
    if (!rider) {
      return res
        .status(404)
        .json({ success: false, message: "Rider not found" });
    }
    rider.DocumentVerify = DocumentVerify;
    await rider.save();
    res.status(200).json({
      success: true,
      message: "Documents verified successfully",
    });
  } catch (error) {
    console.log("Internal server error", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Change location of a rider
exports.changeLocation = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { location } = req.body;

    if (
      !location ||
      !Array.isArray(location.coordinates) ||
      location.coordinates.length !== 2
    ) {
      return res.status(400).json({ error: "Invalid location format" });
    }

    const updatedRider = await Rider.findByIdAndUpdate(
      riderId,
      { location },
      { new: true }
    );

    if (!updatedRider) {
      return res.status(404).json({ error: "Rider not found" });
    }

    res
      .status(200)
      .json({ message: "Location updated successfully", rider: updatedRider });
  } catch (error) {
    console.error("Error updating location:", error);
    res.status(500).json({ error: "Failed to update location" });
  }
};

exports.uploadDocuments = async (req, res) => {
  try {
    console.log("➡️ /uploadDocuments called");

    const userId = req.user?.userId;
    if (!userId) {
      console.log("❌ No user ID found");
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    console.log("✅ Extracted userId:", userId);
    const findRider = await Rider.findById(userId);
    if (!findRider) {
      console.log("❌ Rider not found");
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (findRider.isDocumentUpload && findRider.DocumentVerify === true) {
      return res.status(400).json({
        success: false,
        message: "Documents already uploaded and verified. Please login.",
      });
    }

    const uploadedDocs = {};
    const files = req.files || [];

    if (files.length === 0) {
      console.log("❌ No files found in request");
      return res
        .status(400)
        .json({ success: false, message: "No files uploaded." });
    }

    for (const file of files) {
      try {
        const fileSizeKB = file.size / 1024;
        console.log(
          `📄 File received: ${file.originalname} (${fileSizeKB.toFixed(2)}KB)`
        );

        if (fileSizeKB > 1024) {
          console.log("⚠️ File too large:", file.originalname);
          await fs.unlink(file.path).catch(() => { });
          return res.status(400).json({
            success: false,
            message: `${file.originalname} is larger than 1MB`,
          });
        }

        console.log("☁️ Uploading to Cloudinary:", file.originalname);
        const uploaded = await cloudinary.uploader.upload(file.path, {
          folder: "rider_documents",
          quality: "auto:low",
          format: "jpg",
        });

        console.log("✅ Uploaded:", uploaded.secure_url);

        if (file.originalname.includes("dl"))
          uploadedDocs.license = uploaded.secure_url;
        if (file.originalname.includes("rc"))
          uploadedDocs.rc = uploaded.secure_url;
        if (file.originalname.includes("insurance"))
          uploadedDocs.insurance = uploaded.secure_url;
        if (file.originalname.includes("aadharBack"))
          uploadedDocs.aadharBack = uploaded.secure_url;
        if (file.originalname.includes("aadharFront"))
          uploadedDocs.aadharFront = uploaded.secure_url;
        if (file.originalname.includes("pancard"))
          uploadedDocs.pancard = uploaded.secure_url;
        if (file.originalname.includes("profile"))
          uploadedDocs.profile = uploaded.secure_url;

        // Delete the temp file
        try {
          await fs.promises.unlink(file.path); // ✅ Promise-based
          console.log(`✅ Temp file deleted: ${file.originalname}`);
        } catch (err) {
          console.warn(
            `⚠️ Could not delete temp file: ${file.originalname}`,
            err.message
          );
        }
      } catch (fileErr) {
        console.error("❌ Error processing file:", file.originalname, fileErr);
        return res.status(500).json({
          success: false,
          message: `Failed to process ${file.originalname}`,
          error: fileErr.message,
        });
      }
    }

    findRider.documents = uploadedDocs;
    findRider.isDocumentUpload = true;
    findRider.isProfileComplete = true;

    try {
      await findRider.save();
      console.log("✅ Rider saved successfully");
    } catch (dbErr) {
      console.error("❌ Error saving rider:", dbErr);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to save documents",
          error: dbErr.message,
        });
    }

    return res.status(201).json({
      success: true,
      message: "Documents uploaded successfully",
      data: uploadedDocs,
    });
  } catch (mainErr) {
    console.error("❌ Unexpected error in /uploadDocuments:", mainErr);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: mainErr.message,
    });
  }
};

exports.uploadPaymentQr = async (req, res) => {
  try {
    const file = req.file || {};

    const userId = req.user.userId;
    const findRider = await Rider.findById(userId);

    if (!findRider) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const uploadedDocs = {};

    const uploadResponse = await cloudinary.uploader.upload(file.path, {
      folder: "rider_qrs",
    });
    fs.unlinkSync(file.path);

    findRider.YourQrCodeToMakeOnline = uploadResponse.secure_url;

    await findRider.save();

    res
      .status(201)
      .json({
        success: true,
        message: "Documents uploaded successfully",
        data: uploadResponse,
      });
  } catch (error) {
    console.error("Error uploading documents:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Documents upload failed",
        error: error.message,
      });
  }
};

exports.details = async (req, res) => {
  try {
    const userId = req.user?.userId;

    // Check if userId exists
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Find the partner
    const partner = await Rider.findById(userId);
    // console.log(partner)
    // If partner not found, return error
    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // Return response
    return res.status(200).json({ success: true, partner });
  } catch (error) {
    console.error("Error fetching partner details:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

exports.getMyAllDetails = async (req, res) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const findRideDetails = await rideRequestModel.find({
      rider: user_id,
      rideStatus: "completed",
    });

    const totalRides = findRideDetails.length;
    const totalEarnings = findRideDetails.reduce(
      (acc, cur) => acc + Number(cur.kmOfRide),
      0
    );

    const totalRatings = findRideDetails.reduce(
      (acc, cur) => acc + (cur.RatingOfRide || 0),
      0
    );
    const averageRating = totalRides > 0 ? totalRatings / totalRides : 0;

    // Send response with all computed data
    return res.status(200).json({
      totalRides,
      totalEarnings,
      averageRating,
    });
  } catch (error) {
    console.error("Error fetching ride details:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getMyAllRides = async (req, res) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const findRideDetails = await rideRequestModel
      .find({ rider: user_id })
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      message: "Ride details fetched successfully",
      count: findRideDetails.length,
      data: findRideDetails,
    });
  } catch (error) {
    console.error("Error fetching ride details:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.toggleWorkStatusOfRider = async (req, res) => {
  try {
    const user_id = req.user?.userId;

    if (!user_id) {
      return res.status(401).json({ message: "User ID is required" });
    }

    // Fetch the current status of the rider
    const rider = await Rider.findById({ _id: user_id });
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    if (!rider.isPaid) {
      return res.status(400).json({
        message:
          "Oops! It looks like your account isn’t recharged. Please top up to proceed.",
      });
    }

    // Toggle the status dynamically
    const newStatus = !rider.isAvailable;

    // Check if rider is trying to go offline while having an active ride
    if (!newStatus && rider.on_ride_id) {
      return res.status(400).json({
        message:
          "You currently have an active ride. Please complete the ride before going offline.",
      });
    }

    // Update rider's isAvailable status
    const toggleStatus = await Rider.updateOne(
      { _id: user_id },
      { $set: { isAvailable: newStatus } }
    );

    if (toggleStatus.modifiedCount !== 1) {
      return res.status(400).json({ message: "Status update failed" });
    }

    // Handle CabRider session tracking
    const today = moment().format("YYYY-MM-DD");
    let cabRider = await CabRiderTimes.findOne({
      riderId: user_id,
      date: today,
    });

    if (!cabRider) {
      cabRider = new CabRiderTimes({
        riderId: user_id,
        status: newStatus ? "online" : "offline",
        date: today,
        sessions: [],
      });
    } else {
      // Update status
      cabRider.status = newStatus ? "online" : "offline";
    }

    if (newStatus) {
      // Rider is going online - start a new session
      cabRider.sessions.push({
        onlineTime: new Date(),
        offlineTime: null,
        duration: null,
      });
    } else {
      // Rider is going offline - close the last session
      const lastSession = cabRider.sessions[cabRider.sessions.length - 1];
      if (lastSession && !lastSession.offlineTime) {
        lastSession.offlineTime = new Date();
        lastSession.duration = Math.round(
          (new Date() - new Date(lastSession.onlineTime)) / 60000
        );
      }
    }

    await cabRider.save();

    return res.status(200).json({
      success: true,
      message: `Status updated to ${newStatus ? "Available (Online)" : "Unavailable (Offline)"
        } successfully.`,
      cabRider,
    });
  } catch (error) {
    console.error("Error toggling work status:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.markPaid = async (req, res) => {
  try {
    const { rechargePlan, expireData, approveRecharge, riderBh } =
      req.body || {};
    console.log("rbody", req.body);
    // Find the rider by ID
    const findRider = await Rider.findOne({ BH: riderBh });

    if (!findRider) {
      return res
        .status(404)
        .json({ success: false, message: "Rider not found" });
    }

    // If approveRecharge is true, update the recharge details
    if (approveRecharge) {
      findRider.RechargeData = {
        rechargePlan: rechargePlan,
        expireData: expireData,
        approveRecharge: true,
      };
      findRider.isPaid = true;

      // Save the updated rider details
      await findRider.save();

      return res.status(200).json({
        success: true,
        message: "Recharge approved and rider marked as paid.",
        data: findRider,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Recharge approval is required.",
      });
    }
  } catch (error) {
    console.error("Error in markPaid:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.getMySessionsByUserId = async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required in query." });
    }

    const sessionsData = await CabRiderTimes.find({ riderId: userId }).sort({
      date: -1,
    });

    if (!sessionsData.length) {
      return res
        .status(404)
        .json({ message: "No session data found for this user." });
    }

    // Prepare response data
    const result = sessionsData.map((daySession) => {
      let totalDurationInSeconds = 0;

      // Calculate total duration and format individual sessions
      const formattedSessions = daySession.sessions.map((session) => {
        if (session.onlineTime && session.offlineTime) {
          totalDurationInSeconds += session.duration * 60;
        }

        return {
          onlineTime: session.onlineTime,
          offlineTime: session.offlineTime || "Active", // If still online
          duration: session.duration
            ? `${Math.floor(session.duration)} min`
            : "Ongoing",
        };
      });

      // Format total time for the day
      const hours = Math.floor(totalDurationInSeconds / 3600);
      const minutes = Math.floor((totalDurationInSeconds % 3600) / 60);
      const seconds = totalDurationInSeconds % 60;

      const totalTimeFormatted = `${hours}h ${minutes}m ${seconds}s`;

      return {
        date: daySession.date,
        totalSessions: daySession.sessions.length,
        totalTimeOnline: totalTimeFormatted,
        sessions: formattedSessions,
      };
    });

    return res.status(200).json({
      message: "Session data fetched successfully.",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching session data:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.verifyDocument = async (req, res) => {
  try {
    const BH = req.query.bh || {};
    const findRider = await Rider.findOne({ BH });

    if (!findRider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    if (findRider.DocumentVerify === true) {
      return res.status(200).json({ message: "Document already verified" });
    }

    const verifyDocument = await Rider.updateOne(
      { BH },
      { $set: { DocumentVerify: true } }
    );

    if (verifyDocument.modifiedCount === 1) {
      // Send WhatsApp confirmation message
      const congratsMessage = `🎉 Congratulations ${findRider.name}! 

Your documents have been successfully verified, and you are now officially part of our team. 

🚀 Get ready to start your journey with us, delivering excellence and earning great rewards. We appreciate your dedication and look forward to seeing you grow with us.

💡 Stay active, provide the best service, and unlock more opportunities in the future.

Welcome aboard! 🚖💨`;

      await SendWhatsAppMessage(congratsMessage, findRider.phone);

      return res
        .status(200)
        .json({ message: "Document verified successfully" });
    }

    return res
      .status(400)
      .json({ message: "Verification failed, please try again." });
  } catch (error) {
    console.error("Error verifying document:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.updateBlockStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isBlockByAdmin } = req.body;
    const riderData = await Rider.findById(id);
    if (!riderData) {
      return res
        .status(404)
        .json({ success: false, message: "Rider not found." });
    }

    riderData.isBlockByAdmin = isBlockByAdmin;
    const result = await riderData.save();
    return res
      .status(200)
      .json({
        success: true,
        message: "Block status updated successfully",
        data: result,
      });
  } catch (error) {
    console.error("Error updating block status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.getSingleRider = async (req, res) => {
  try {
    const { id } = req.params;
    const rider = await Rider.findById(id);
    if (!rider) {
      return res
        .status(404)
        .json({ success: false, message: "Rider not found" });
    }
    res.status(200).json({
      success: true,
      message: "Rider found successfully",
      data: rider,
    });
  } catch (error) {
    console.log("Internal server error", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
exports.updateRiderDocumentVerify = async (req, res) => {
  try {
    const { id } = req.params;
    const { DocumentVerify } = req.body || req.query;

    const rider = await Rider.findById(id);
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider not found",
      });
    }

    // Update document verification status
    rider.DocumentVerify = DocumentVerify;

    async function grantFreeTier(rider) {
      rider.isFreeMember = true;
      rider.isPaid = true;

      const oneYearLater = new Date();
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
      rider.freeTierEndData = oneYearLater;

      rider.RechargeData = {
        rechargePlan: "Free Tier",
        expireData: oneYearLater,
        approveRecharge: true,
      };

      await SendWhatsAppMessage(
        `🎉 Dear ${rider.name
        }, your documents have been successfully verified, and you've been granted 1 year of Free Tier membership! 🗓️
    
    ✅ Plan: Free Tier  
    ✅ Valid Till: ${oneYearLater.toDateString()}  
    ✅ Recharge Status: Approved
    
    We’re excited to have you on board. Let’s make your journey productive and rewarding. Stay safe and deliver with pride! 🚀  
    — Team Support`,
        rider.phone
      );
    }

    const vehicleName = rider.rideVehicleInfo?.vehicleName?.toLowerCase();
    const vehicleType = rider.rideVehicleInfo?.vehicleType?.toLowerCase();

    if (rider.category === "parcel") {
      grantFreeTier(rider);
    } else if (
      rider.category === "cab" &&
      (vehicleName === "bike" || vehicleType === "bike")
    ) {
      grantFreeTier(rider);
    } else {
      // All other cases
      await SendWhatsAppMessage(
        `✅ Hello ${rider.name}, your documents have been successfully verified! 🎉
    
    You are now fully approved to continue providing your services on our platform.
    
    Thank you for your patience and welcome to the community! 😊  
    — Team Support`,
        rider.phone
      );
    }

    const result = await rider.save();

    return res.status(200).json({
      success: true,
      message: "Rider documents verified and updated successfully.",
      data: result,
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while verifying the documents.",
    });
  }
};

exports.updateRiderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, rideVehicleInfo } = req.body;

    // Find the existing rider
    const existingData = await Rider.findById(id);
    if (!existingData) {
      return res
        .status(404)
        .json({ success: false, message: "Rider not found" });
    }

    console.log("Existing Rider Data:", existingData);

    // Update basic details if provided
    if (name) existingData.name = name;
    if (phone) existingData.phone = phone;

    // Update ride vehicle details if provided
    if (rideVehicleInfo) {
      existingData.rideVehicleInfo = {
        ...existingData.rideVehicleInfo,
        ...rideVehicleInfo, // Merge existing & new data
      };
    }

    console.log("Received Files:", req.files);

    // Handle document uploads if files are provided
    if (req.files && req.files.length > 0) {
      const uploadedDocs = { ...existingData.documents };

      for (const file of req.files) {
        // Upload file to Cloudinary
        const uploadResponse = await cloudinary.uploader.upload(file.path, {
          folder: "rider_documents",
        });

        console.log(
          `Uploading file: ${file.fieldname} -> ${uploadResponse.secure_url}`
        );

        // Assign uploaded file URL dynamically based on fieldname
        uploadedDocs[file.fieldname] = uploadResponse.secure_url;

        // Delete the local file after upload
        fs.unlinkSync(file.path);
      }

      // Merge updated documents with existing ones
      existingData.documents = { ...existingData.documents, ...uploadedDocs };
      existingData.markModified("documents"); // Ensure Mongoose detects the change
    }

    // Save the updated rider details
    await existingData.save();

    console.log("Updated Rider Data:", await Rider.findById(id));

    res
      .status(200)
      .json({
        success: true,
        message: "Rider details updated successfully",
        data: existingData,
      });
  } catch (error) {
    console.error("Internal server error", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.getOnlineTimeByRiderId = async (req, res) => {
  try {
    const { id } = req.params;
    const riderStatus = await CabRiderTimes.find({ riderId: id });
    if (!riderStatus) {
      return res
        .status(404)
        .json({ success: false, message: "No data found", data: [] });
    }
    res.status(200).json({
      success: true,
      message: "Online time found successfully",
      data: riderStatus,
    });
  } catch (error) {
    console.log("Internal server error", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.deleteRider = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRider = await Rider.findByIdAndDelete(id);
    if (!deletedRider) {
      return res
        .status(404)
        .json({ success: false, message: "Rider not found" });
    }
    res
      .status(200)
      .json({
        success: true,
        message: "Rider deleted successfully",
        data: deletedRider,
      });
  } catch (error) {
    console.log("Internal server error", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.getMyEligibleBonus = async (req, res) => {
  try {
    const userId = req.user?.userId || req.query.userId || req.params.userId;
    // console.log("UserId:", userId);

    if (!userId) {
      return res.status(400).json({ message: "User ID is required in query." });
    }

    const sessionsData = await CabRiderTimes.find({ riderId: userId }).sort({
      date: -1,
    });
    // console.log("Fetched sessionsData:", sessionsData.length);

    if (!sessionsData.length) {
      return res
        .status(404)
        .json({ message: "No session data found for this user." });
    }

    const BonusAvailableInDb = await Bonus_Model.find();
    // console.log("Fetched BonusAvailableInDb:", BonusAvailableInDb.length);

    if (!BonusAvailableInDb.length) {
      return res.status(404).json({ message: "No bonuses available." });
    }

    let eligibleBonus = [];
    let notEligibleBonus = [];

    let totalDurationHours = 0;

    // Calculate total working hours
    for (let sessionData of sessionsData) {
      for (let session of sessionData.sessions) {
        // console.log("Processing session:", session);

        const onlineTime = momentTz(session.onlineTime).tz("Asia/Kolkata");
        const offlineTime = momentTz(session.offlineTime).tz("Asia/Kolkata");

        // console.log("OnlineTime:", onlineTime.isValid() ? onlineTime.format() : "Invalid");
        // console.log("OfflineTime:", offlineTime.isValid() ? offlineTime.format() : "Invalid");

        if (!onlineTime.isValid() || !offlineTime.isValid()) {
          // console.log("Skipping invalid session times.");
          continue; // skip this session
        }

        const durationMinutes = offlineTime.diff(onlineTime, "minutes");
        const durationHours = durationMinutes / 60;

        // console.log("Session durationMinutes:", durationMinutes, "durationHours:", durationHours);

        if (!isNaN(durationHours)) {
          totalDurationHours += durationHours;
        } else {
          console.log("Invalid durationHours, skipping...");
        }
      }
    }

    // console.log("Total Duration Hours:", totalDurationHours);

    // Now check for bonuses
    BonusAvailableInDb.forEach((bonus) => {
      // console.log("Checking bonus:", bonus);

      const anyRequiredField = [
        `Complete login hours: ${bonus.requiredHours} hours worked.`,
        "Do not reject more than 5 bonus claims per month to maintain eligibility.",
        "Requires regular check-ins and updates for performance.",
      ];

      if (totalDurationHours >= bonus.requiredHours) {
        console.log(
          `Eligible: totalDurationHours(${totalDurationHours}) >= requiredHours(${bonus.requiredHours})`
        );

        eligibleBonus.push({
          requiredHours: bonus.requiredHours,
          bonusCouponCode: bonus.bonusCouponCode,
          bonusType: bonus.bonusType,
          bonusValue: bonus.bonusValue,
          bonusStatus: bonus.bonusStatus,
          any_required_field: anyRequiredField,
          remainingHours: parseFloat(
            (totalDurationHours - bonus.requiredHours).toFixed(2)
          ),
        });
      } else {
        // console.log(`Not Eligible: totalDurationHours(${totalDurationHours}) < requiredHours(${bonus.requiredHours})`);

        notEligibleBonus.push({
          requiredHours: bonus.requiredHours,
          bonusCouponCode: bonus.bonusCouponCode,
          bonusType: bonus.bonusType,
          bonusValue: bonus.bonusValue,
          bonusStatus: bonus.bonusStatus,
          any_required_field: anyRequiredField,
          remainingHours: parseFloat(
            (bonus.requiredHours - totalDurationHours).toFixed(2)
          ),
        });
      }
    });

    // console.log("Eligible Bonuses:", eligibleBonus);
    // console.log("Not Eligible Bonuses:", notEligibleBonus);

    return res.status(200).json({
      message:
        "Rider's eligible and not eligible bonuses fetched successfully.",
      eligibleBonus,
      notEligibleBonus,
    });
  } catch (error) {
    console.error("Error fetching eligible bonus:", error);
    return res.status(500).json({
      message: "An error occurred while fetching eligible bonuses.",
      error: error.message,
    });
  }
};

exports.inProgressOrder = async (req, res) => {
  try {
    const userId = req.user?.userId || req.query.userId || req.params.userId;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required in query." });
    }

    const rider = await Rider.findOne({ _id: userId, category: "parcel" });
    if (!rider) {
      return res
        .status(404)
        .json({ success: false, message: "Rider not found" });
    }

    // Fetch all accepted orders for this rider
    const inProgress = await Parcel_Request.find({
      rider_id: userId,
      status: {
        $not: /^(pending|delivered|cancelled)$/i,
      },
    });

    if (inProgress.length === 0) {
      // No in-progress orders found
      return res.status(200).json({
        success: true,
        message: "No in-progress orders found.",
        inProgressOrders: [],
      });
    }

    return res.status(200).json({
      success: true,
      message: "In-progress orders fetched successfully.",
      inProgressOrders: inProgress,
    });
  } catch (error) {
    console.error("Error fetching in-progress orders:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching in-progress orders.",
      error: error.message,
    });
  }
};

exports.parcelDashboardData = async (req, res) => {
  try {
    const userId = req.user?.userId || req.query.userId || req.params.userId;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required in query." });
    }

    const rider = await Rider.findOne({ _id: userId, category: "parcel" });
    if (!rider) {
      return res
        .status(404)
        .json({ success: false, message: "Rider not found" });
    }

    const howManyDeliverDone = await Parcel_Request.countDocuments({
      rider_id: userId,
      status: "delivered",
    });

    const inProgress = await Parcel_Request.find({
      rider_id: userId,
      status: {
        $not: /^(pending|delivered|cancelled)$/i,
      },
    });

    const deliveredRequests = await Parcel_Request.find({
      rider_id: userId,
      status: "delivered",
    });

    const totalMoneyEarned = deliveredRequests.reduce(
      (acc, cur) => acc + Number(cur?.fares?.payableAmount || 0),
      0
    );

    return res.status(200).json({
      success: true,
      message: "Parcel dashboard data fetched successfully.",
      data: {
        totalDeliveries: howManyDeliverDone,
        inProgressDeliveries: inProgress.length,
        totalEarnings: totalMoneyEarned,
        ridesRejected: rider.ridesRejected,
      },
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while fetching dashboard data.",
      error: error.message,
    });
  }
};
