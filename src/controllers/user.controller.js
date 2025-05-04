import { asyncHandler } from "../utils/asyncHandler.js";
import bcrypt from "bcryptjs";
import { Apierror } from "../utils/Apierror.js";
import { User } from "../models/user.model.js";
import { uploadoncloudinary } from "../utils/cloudinary.js";
import { Apiresponse } from "../utils/Apiresponse.js";

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

  const hashedPassword = await bcrypt.hash(password, 10);

  let user;
  try {
    user = await User.create({
      fullname,
      avatar: avatar.url,
      coverimage: coverimage?.url || "",
      password: hashedPassword,
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

export { registerUser };
