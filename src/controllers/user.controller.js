import { asyncHandler } from "../utils/asyncHandler.js";
import { Apierror } from "../utils/Apierror.js";
import { User } from "../models/user.model.js";
import {uploadoncloudinary} from "../utils/cloudinary.js";
import { Apiresponse } from "../utils/Apiresponse.js";
 
const registerUser= asyncHandler( async (req,res)=>{
    //get user details from frontend
    // validation -- not empty
    //check if user already exist -- you can check using email and username
    //check for images
    //check for avatar
    //upload them to cloudinary, avatar
    // create user object -- create entry in db
    // remove password and refresh token field from response
    // check for user creation 
    // return response


    //get user details from frontend
    const {fullname,email,username,password} = req.body
    console.log("email ",email);

        if ([fullname,email,password,username].some((field)=>field?.trim()==="")) {
            throw new Apierror(400)
        }

       const existeduser= User.findOne({
            $or: [{username},{email}]
        })
        if(existeduser){
            throw new Apierror(409)
        }

       const avatalocalpath = req.files?.avatar[0]?.path;
       const coverimagelocalpath = req.files?.coverimage[0]?.path;

       if(!avatalocalpath){
        throw new Apierror(402) 
       }

       const avatar = await uploadoncloudinary(avatalocalpath)
       const coverimage = await uploadoncloudinary(coverimagelocalpath)

       if(!avatar){
        throw new Apierror(403)
       }

      const user= await User.create({
        fullname,
        avatar:avatar.url,
        coverimage: coverimage?.url || "",
        password,
        username: username.toLowerCase(),
        email
       })

       const createduser = await User.findById(user._id).select(
        "-password  -refreshToken" 
       )

       if(!createduser){
        throw new Apierror(500)
       }

       return res.status(201).json(
        new Apiresponse(200, createduser, "User Registerd Successfully")
       )

   })
 
export {registerUser}