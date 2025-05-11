import { asyncHandler } from "../utils/asyncHandler.js";
import bcrypt from "bcryptjs";
import { Apierror } from "../utils/Apierror.js";
import { User } from "../models/user.model.js";
import { deleteoncloudinary, uploadoncloudinary } from "../utils/cloudinary.js";
import { Apiresponse } from "../utils/Apiresponse.js";
import jwt from "jsonwebtoken";
import { response } from "express";

const generateAccessTokenAndReferenceToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();     // ⬅️ no await
    const refreshToken = user.generateRefreshToken();   // ⬅️ no await

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new Apierror(500, "Something went wrong while generating tokens");
  }
};


const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  if ([fullname, email, password, username].some((field) => field?.trim() === "")) {
    throw new Apierror(400, "All fields are required");
  }

  const existeduser = await User.findOne({ $or: [{ username }, { email }] });

  if (existeduser) {
    throw new Apierror(409, "User with this username or email already exists");
  }

  const avatalocalpath = req.files?.avatar?.[0]?.path;
  const coverimagelocalpath = req.files?.coverimage?.[0]?.path;

  if (!avatalocalpath) {
    throw new Apierror(402, "Avatar is required");
  }

  const avatar = await uploadoncloudinary(avatalocalpath);
  const coverimage = coverimagelocalpath ? await uploadoncloudinary(coverimagelocalpath) : { url: "" };

  if (!avatar) {
    throw new Apierror(403, "Avatar upload failed");
  }


  let user;
  try {
    user = await User.create({
      fullname,
      avatar: avatar.url,
      coverimage: coverimage?.url || "",
      password:password,
      username: username.toLowerCase(),
      email,
    });
    console.log("User created successfully:", user);
  } catch (err) {
    console.error("Error creating user:", err);
    throw new Apierror(500, "Error creating user.");
  }

  const createduser = await User.findById(user._id).select("-password -refreshToken");

  if (!createduser) {
    throw new Apierror(500, "Failed to retrieve user after creation");
  }

  return res.status(201).json(new Apiresponse(200, createduser, "User Registered Successfully"));
});


const loginUser = asyncHandler(async (req,res)=>{
    //req body->data
    // username,email
    //find the user
    //check password
    //acess and refresh token genrate 
    //send cookie
    const {email,username,password} = req.body
    if (!username && !email) {
      throw new Apierror(400,"username or password required")
    }

    const user= await User.findOne({
      $or:[{username},{email}]
    }) 
    if(!user){
      throw new Apierror(404,"User Not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
      throw new Apierror(401,"Password incorrect")
    }

    const { accessToken, refreshToken } = await generateAccessTokenAndReferenceToken(user._id);
    console.log("AccessToken:", accessToken);
    console.log("RefreshToken:", refreshToken);
    

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")


    const options = {
      httpOnly: true,
      secure: false
    }

    return res.status(200).cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
      new Apiresponse(200,
        {
          user: loggedInUser,accessToken,refreshToken
        },
        "User Loggedin successfully"
      )
    )

})


const loggOutUser = asyncHandler(async(req,res)=>{
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set:{
        refreshToken: undefined
      }
    },
    {
      new:true
    }
  )
  const options = {
    httpOnly: true,
    secure: true
  }
  return res.status(200).clearCookie("accessToken", options).clearCookie("refreshToken", options).json(
    new Apiresponse(200,{},"User logged out")
  )
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
  const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken
  if(!incomingRefreshToken){
    throw new Apierror(401,"unauthorized request at incomingRefreshtoken")
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
  
    const user = await User.findById(decodedToken?._id)
  
    if(!user){
      throw new Apierror(401,"Invalid incomingrefreshtoken")
    }
  
    console.log(`IncomingRefreshToken: ${incomingRefreshToken}`)
  
    if(incomingRefreshToken !== user?.refreshToken){
      throw new Apierror(401,"Refresh token is expired or does not match!!")
    }
  
    const options ={
      httpOnly:true,
      secure:false
    }
  
    const {accessToken,newrefreshToken} = await generateAccessTokenAndReferenceToken(user._id)
  
    return res.status(200).cookie("accessToken",accessToken,options).cookie("refreshToken",newrefreshToken,options)
    .json(
      new Apiresponse(
        200,
        {accessToken,refreshToken:newrefreshToken},
        "Access token refreshed"
      )
    )
  } catch (error) {
    throw new Apierror(401,error?.message || "Invalid incoming refresh token in catch block")
  }
  
})


const changeCurrentPassword = asyncHandler(async(req,res)=>{
  const {oldPassword,newPassword} = req.body

  const user = await User.findById(req.user?._id)
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
  
  if(!isPasswordCorrect){
    throw new Apierror(400,"Invalid old Password")
  }

  user.password = newPassword
  await user.save({validateBeforeSave: false})

  return res.status(200).json(new Apiresponse(200,{},"Password changed successfully"))

})

const getCurrentUser = asyncHandler(async(req,res)=>{
  return res.status(200).json(new Apiresponse(200,req.user,"Current User fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
  const {fullname,email} = req.body

  if(!fullname || !email){
    throw new Apierror (400,"All fileds are required")
  }

  const user = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set : {
        fullname,
        email
      }
    },
    {new: true}
  ).select("-password")
  return res.status(200).json(new Apiresponse(200,user,"Account details updated successfully"))
})


const updateUserCoverimage = asyncHandler(async(req,res)=>{
  const coverimageLocalPath = req.file?.path

  if(!coverimageLocalPath){
    throw new Apierror(400,"cover image file is missing")
  }

  const imgurl = req.body.imageUrl;
  if(!imgurl){
    throw new Apierror(404,"coverimage file not found")
  }
  const deleteavatar = await deleteoncloudinary(imgurl)

  if(!deleteavatar){
    throw new Apierror(500,"previous coverimage file not deleted")
  }

  const coverimage = await uploadoncloudinary(coverimageLocalPath)

  if(!coverimage.url){
    throw new Apierror(400,"Error while uploading coverimage")
  }
  
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        coverimage: coverimage.url
      }
    },
    {new:true}
  ).select("-password")

    return res.status(200).json(new Apiresponse(200,user,"cover image updated successfully"))
})
const updateUserAvatar = asyncHandler(async(req,res)=>{
  const avatarLocalPath = req.file?.path

  if(!avatarLocalPath){
    throw new Apierror(400,"Avatar file is missing")
  }
  const imgurl = req.body.imageUrl;
  if(!imgurl){
    throw new Apierror(404,"avatar file not found")
  }
  const deleteavatar = await deleteoncloudinary(imgurl)

  if(!deleteavatar){
    throw new Apierror(500,"previous avatar file not deleted")
  }
  const avatar = await uploadoncloudinary(avatarLocalPath)

  if(!avatar.url){
    throw new Apierror(400,"Error while uploading Avatar")
  }
  
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        avatar: avatar.url
      }
    },
    {new:true}
  ).select("-password")

  return res.status(200).json(new Apiresponse(200,user,"Avatar is updated successfully"))

})

export { 
  registerUser, 
  loginUser,
  loggOutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverimage
};
