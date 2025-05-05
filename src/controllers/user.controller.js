import { asyncHandler } from "../utils/asyncHandler.js";
import bcrypt from "bcryptjs";
import { Apierror } from "../utils/Apierror.js";
import { User } from "../models/user.model.js";
import { uploadoncloudinary } from "../utils/cloudinary.js";
import { Apiresponse } from "../utils/Apiresponse.js";

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



export { registerUser, 
  loginUser,
  loggOutUser
};
