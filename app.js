const express = require('express');
const mongoose = require('mongoose');
const pdf2pic = require('pdf2pic');
const { fromPath } = require('pdf2pic');

require("dotenv").config();

const cloudinary = require('cloudinary').v2;
const cloudinary1 = require('cloudinary').v2;
const cloudinary2 = require('cloudinary').v2;
const cloudinary3 = require('cloudinary').v2;
const cloudinary4 = require('cloudinary').v2;
//Cloudinary 

const multer = require('multer');
const app = express();
const axios = require('axios');
const PDFDocument = require('pdfkit');
const port = process.env.port;
const jwt = require('jsonwebtoken');

app.use(express.urlencoded({ extended: true }));


//Cloudinary connection
//Venkat
cloudinary.config({
    cloud_name: process.env.cloud,
    api_key: process.env.api,
    api_secret: process.env.apis,
    secure: true,
});
          
//Argha
cloudinary1.config({ 
    cloud_name: process.env.cloud1,
    api_key: process.env.api1,
    api_secret: process.env.apis1,
    secure: true,
});

//Pujitha
cloudinary2.config({ 
    cloud_name: process.env.cloud2,
    api_key: process.env.api2,
    api_secret: process.env.apis2,
    secure: true,
});

//Saritha
cloudinary3.config({ 
    cloud_name: process.env.cloud3,
    api_key: process.env.api3,
    api_secret: process.env.apis3,
    secure: true,
});

//Manideep  
cloudinary4.config({ 
    cloud_name: process.env.cloud4,
    api_key: process.env.api4,
    api_secret: process.env.apis4,
    secure: true,
});

// MongoDB connection
let password = process.env.mongopass;
let user = process.env.mongouser;
mongoose.connect('mongodb+srv://' + user + password + '@cluster0.b59pavi.mongodb.net/?retryWrites=true&w=majority', {
    useNewUrlParser: true,
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Define MongoDB schemas and models
const downloadSchema = new mongoose.Schema({
    totalDownloads: Number,
});


// MongoDB Schema
const Download = mongoose.model('download', downloadSchema);

const userSchema = new mongoose.Schema({
    userName: String,
    password: String,
});

const User = mongoose.model('user', userSchema)

const courseSchema = new mongoose.Schema({
    courseCode: String,
    courseName: String,
});

const Course = mongoose.model('course', courseSchema)

const paperIdSchema = new mongoose.Schema({
    currentId: Number,
});

//Papers schema
const PaperId = mongoose.model('PaperId', paperIdSchema);

const postSchema = new mongoose.Schema({
    paperId: Number,
    examDate: String,
    examYear:String,
    courseCode: String,
    slot: String,
    examType: String,
    verified: Number,
    images: [String],
});

const Post = mongoose.model('Post', postSchema);

//Feerback schema
const feedbackSchema = new mongoose.Schema({
    name: String,
    regdNumber: String,
    rating: Number,
    feedback: String,
    seen:Number,
})

const Feedback = mongoose.model('Feedback', feedbackSchema);

// Home route
// Define a route for the root path '/'
app.get('/', async (req, res) => {
    try {
        // Fetch totalDownloads from the Download collection
        const downloadData = await Download.findOne({}).maxTimeMS(20000);
        const totalDownloads = downloadData ? downloadData.totalDownloads : 0;

        // Fetch all feedbacks from the Feedback collection
        const feedbacks = await Feedback.find({});
        let totalRating = 0;

        // Calculate the total rating by summing up individual feedback ratings
        feedbacks.forEach((feedback) => {
            totalRating += feedback.rating;
        });

        // Use aggregation to find unique posts based on specific fields in the Post collection
        const uniquePostsAggregation = await Post.aggregate([
            {
                $group: {
                    _id: {
                        courseCode: "$courseCode",
                        examType: "$examType",
                        slot: "$slot",
                        examDate: "$examDate"
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 }
                }
            }
        ]);

        // Extract the count of unique posts from the aggregation result
        const totalUniquePosts = uniquePostsAggregation.length > 0 ? uniquePostsAggregation[0].count : 0;

        // Calculate the average rating if there are feedbacks
        const averageRating = feedbacks.length > 0 ? (totalRating / feedbacks.length).toFixed(1) : 0;

        // Render the 'home.ejs' view with the obtained data
        res.render('home.ejs', { totalDownloads, averageRating, totalUniquePosts });
    } catch (error) {
        // Handle errors by logging and sending a 500 Internal Server Error response
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});



// Route for rendering the search page
app.get('/search', (req, res) => {
    res.render('search.ejs');
});

// Route for handling form submission (POST) on the search page
app.post('/search', async function (req, res) {
    // Extract search parameters from the request body
    let courseCode =" ";
    if (req.body.courseCode) {
        courseCode = req.body.courseCode.substring(0, req.body.courseCode.indexOf('(') - 1);
        // Proceed with further processing
    }
    else{
        courseCode = req.body.courseCode;
    }
    const examType = req.body.examType;
    const slot = req.body.slot;
    const year = req.body.year;

    // Create an empty query object to dynamically build the search query
    const query = {};

    // Add search conditions based on the provided parameters
    if (courseCode) {
        query.courseCode = courseCode;
    }

    if (examType && examType !== '0') {
        query.examType = examType;
    }

    if (year) {
        query.examYear = year;
    }

    if (slot && slot !== '0') {
        query.slot = slot;
    }

    try {
        // Construct the complete URL with the search query parameters
        let complete = '/display?' + new URLSearchParams(query).toString();

        // Redirect to the display page with the constructed query
        res.redirect(complete);
    } catch (error) {
        // Handle errors by logging and sending a 500 Internal Server Error response
        console.error('Error constructing query:', error);
        res.status(500).send('An error occurred while processing your request.');
    }
});




//Uploading Route
app.get('/upload', (req, res) => {
    res.render('upload.ejs');
});


app.post('/upload', upload.array('image'), async (req, res) => {
    try {
        let { courseCode, date, slot, type } = req.body;
        courseCode = courseCode.toUpperCase();

        const existingVerifiedPost = await Post.findOne({
            courseCode,
            examDate: date,
            slot,
            examType: type,
            verified: 1,
        });

        if (existingVerifiedPost) {
            return res.status(400).render('errorupload', { error: 'A verified paper already exists with the same details.' });
        }

        // Retrieve and update the paper ID
        const paperIdDoc = await PaperId.findOne();
        let currentPaperId = 1;

        if (paperIdDoc) {
            currentPaperId = paperIdDoc.currentId;
            currentPaperId = (currentPaperId % 10000) + 1;
        }


        const existingUnverifiedPost = await Post.findOne({
            paperId: currentPaperId,
        });

        if (existingUnverifiedPost) {
            for (const imageUrl of existingUnverifiedPost.images) {
                const publicId = imageUrl.match(/\/v(\d+)\/([^/]+)/)[2].replace('.png', '');
                if (publicId) {
                    if(existingUnverifiedPost.paperId%5===0){
                    cloudinary.config({
                        cloud_name: process.env.cloud,
                        api_key: process.env.api,
                        api_secret: process.env.apis,
                        secure: true,
                    });
                    cloudinary.uploader.destroy(publicId, (result) => {
                        //console.log(result);
                    });}
                    if(existingUnverifiedPost.paperId%5===1){
                    cloudinary1.config({ 
                        cloud_name: process.env.cloud1,
                        api_key: process.env.api1,
                        api_secret: process.env.apis1,
                        secure: true,
                        });
                    cloudinary1.uploader.destroy(publicId, (result) => {
                        //console.log(result);
                    });}
                    if(existingUnverifiedPost.paperId%5===2){
                    cloudinary2.config({ 
                        cloud_name: process.env.cloud2,
                        api_key: process.env.api2,
                        api_secret: process.env.apis2,
                        secure: true,
                        });
                    cloudinary2.uploader.destroy(publicId, (result) => {
                        //console.log(result);
                    });}
                    if(existingUnverifiedPost.paperId%5===3){
                    cloudinary3.config({ 
                        cloud_name: process.env.cloud3,
                        api_key: process.env.api3,
                        api_secret: process.env.apis3,
                        secure: true,
                        });
                    cloudinary3.uploader.destroy(publicId, (result) => {
                        //console.log(result);
                    });}
                    if(existingUnverifiedPost.paperId%5===4){
                    cloudinary4.config({ 
                        cloud_name: process.env.cloud4,
                        api_key: process.env.api4,
                        api_secret: process.env.apis4,
                        secure: true,
                        });
                    cloudinary4.uploader.destroy(publicId, (result) => {
                        //console.log(result);
                    });}
                }
            }
            await Post.deleteOne({ _id: existingUnverifiedPost._id });
        }

        // Update the paper ID in the database
        if (paperIdDoc) {
            paperIdDoc.currentId = currentPaperId;
            await paperIdDoc.save();
        } else {
            await PaperId.create({ currentId: currentPaperId });
        }
        
        const uploadedImages = await Promise.all(
            req.files.map(async (file) => {
              const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

              let result;

              if (currentPaperId % 5 === 0) {
                cloudinary.config({
                    cloud_name: process.env.cloud,
                    api_key: process.env.api,
                    api_secret: process.env.apis,
                    secure: true,
                });
                result = await cloudinary.uploader.upload(dataUri);
              } else if (currentPaperId % 5 === 1) {
                cloudinary1.config({ 
                    cloud_name: process.env.cloud1,
                    api_key: process.env.api1,
                    api_secret: process.env.apis1,
                    secure: true,
                  });
                result = await cloudinary1.uploader.upload(dataUri);
              } else if (currentPaperId % 5 === 2) {
                cloudinary2.config({ 
                    cloud_name: process.env.cloud2,
                    api_key: process.env.api2,
                    api_secret: process.env.apis2,
                    secure: true,
                  });
                result = await cloudinary2.uploader.upload(dataUri);
              } else if (currentPaperId % 5 === 3) {
                cloudinary3.config({ 
                    cloud_name: process.env.cloud3,
                    api_key: process.env.api3,
                    api_secret: process.env.apis3,
                    secure: true,
                  });
                result = await cloudinary3.uploader.upload(dataUri);
              } else if (currentPaperId % 5 === 4) {
                cloudinary4.config({ 
                    cloud_name: process.env.cloud4,
                    api_key: process.env.api4,
                    api_secret: process.env.apis4,
                    secure: true,
                  });
                result = await cloudinary4.uploader.upload(dataUri);
              }
          
              return result.secure_url;
            })
          );
        

        const examYear = req.body.date.split('-')[0];
        const post = new Post({
            paperId: currentPaperId,
            examDate: date,
            examYear: examYear,
            courseCode,
            slot,
            examType: type,
            verified: 0,
            images: uploadedImages,
        });

        await post.save();

        res.redirect('/');
    } 
    catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while processing your request.');
    }
});

app.get('/login', (req, res) => {
    res.render('login.ejs');
})

app.post('/login', async (req, res) => {
    const { userName, password } = req.body;
    const user = await User.findOne({ userName });

    if (user) {
        if (password === user.password) {
            const posts = await Post.find({ verified: 0 }).select('courseCode examDate slot examType paperId');
            const token = jwt.sign({ username: user.username }, 'quexa');
            // console.log(token);
            res.render('adminhome.ejs', {token} );
        } else {
            res.render('login.ejs')
        }
    }
    else {
        res.render('login.ejs')
    }}
);

app.get('/verify', async function (req, res) {
    const posts = await Post.find({ verified: 0 }).select('courseCode examDate slot examType paperId');
    res.render('verify.ejs', { posts });
})

app.get('/feedback', async (req, res) => {
    try {
        const feeds = await Feedback.find({ seen: 0 }).select('name regdNumber rating feedback');
        res.render('feedback.ejs', { feeds });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while processing your request.');
    }
});

app.post('/verify', async (req, res) => {
    try {
        const { courseCode, examDate, slot, action, examType } = req.body;


        if (action === 'accept') {
            //If accepted change verified to "1" and other dupliacte posts are deleted 
            await Post.findOneAndUpdate({ courseCode, examDate, slot, examType }, { verified: 1 });
            
            const unverifiedPosts = await Post.find({
                courseCode,
                examDate,
                slot,
                examType: examType,
                verified: 0,
            });
            
            for (const post of unverifiedPosts) {
                for (const imageUrl of post.images) {
                    const publicId = imageUrl.match(/\/v(\d+)\/([^/]+)/)[2].replace('.png', '');
                    if (publicId) {
                        if(post.paperId%5===0){
                        cloudinary.config({
                            cloud_name: process.env.cloud,
                            api_key: process.env.api,
                            api_secret: process.env.apis,
                            secure: true,
                        });
                        cloudinary.uploader.destroy(publicId, (result) => {
                            //console.log(result);
                        });}
                        if(post.paperId%5===1){
                        cloudinary1.config({ 
                            cloud_name: process.env.cloud1,
                            api_key: process.env.api1,
                            api_secret: process.env.apis1,
                            secure: true,
                            });
                        cloudinary1.uploader.destroy(publicId, (result) => {
                            //console.log(result);
                        });}
                        if(post.paperId%5===2){
                        cloudinary2.config({ 
                            cloud_name: process.env.cloud2,
                            api_key: process.env.api2,
                            api_secret: process.env.apis2,
                            secure: true,
                            });
                        cloudinary2.uploader.destroy(publicId, (result) => {
                            //console.log(result);
                        });}
                        if(post.paperId%5===3){
                        cloudinary3.config({ 
                            cloud_name: process.env.cloud3,
                            api_key: process.env.api3,
                            api_secret: process.env.apis3,
                            secure: true,
                            });
                        cloudinary3.uploader.destroy(publicId, (result) => {
                            //console.log(result);
                        });}
                        if(post.paperId%5===4){
                        cloudinary4.config({ 
                            cloud_name: process.env.cloud4,
                            api_key: process.env.api4,
                            api_secret: process.env.apis4,
                            secure: true,
                            });
                        cloudinary4.uploader.destroy(publicId, (result) => {
                            //console.log(result);
                        });}
                    }
                }
                await Post.deleteOne({ _id: post._id });
            }
            
            res.redirect('/verify')
        } else if (action === 'decline') {
            //If declined the post is deleted
            const post = await Post.findOne({ courseCode, examDate, slot });
            if (post) {
                for (const imageUrl of post.images) {
                    const publicId = imageUrl.match(/\/v(\d+)\/([^/]+)/)[2].replace('.png', '');
                    if (publicId) {
                        if(post.paperId%5===0){
                        cloudinary.config({
                            cloud_name: process.env.cloud,
                            api_key: process.env.api,
                            api_secret: process.env.apis,
                            secure: true,
                        });
                        cloudinary.uploader.destroy(publicId, (result) => {
                            //console.log(result);
                        });}
                        if(post.paperId%5===1){
                        cloudinary1.config({ 
                            cloud_name: process.env.cloud1,
                            api_key: process.env.api1,
                            api_secret: process.env.apis1,
                            secure: true,
                            });
                        cloudinary1.uploader.destroy(publicId, (result) => {
                            //console.log(result);
                        });}
                        if(post.paperId%5===2){
                        cloudinary2.config({ 
                            cloud_name: process.env.cloud2,
                            api_key: process.env.api2,
                            api_secret: process.env.apis2,
                            secure: true,
                            });
                        cloudinary2.uploader.destroy(publicId, (result) => {
                            //console.log(result);
                        });}
                        if(post.paperId%5===3){
                        cloudinary3.config({ 
                            cloud_name: process.env.cloud3,
                            api_key: process.env.api3,
                            api_secret: process.env.apis3,
                            secure: true,
                            });
                        cloudinary3.uploader.destroy(publicId, (result) => {
                            //console.log(result);
                        });}
                        if(post.paperId%5===4){
                        cloudinary4.config({ 
                            cloud_name: process.env.cloud4,
                            api_key: process.env.api4,
                            api_secret: process.env.apis4,
                            secure: true,
                            });
                        cloudinary4.uploader.destroy(publicId, (result) => {
                            //console.log(result);
                        });}
                    }
                }
                await Post.deleteOne({ courseCode, examDate, slot });
            }
            res.redirect('/verify')
        } else {
            res.status(400).send('Invalid action');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while processing your request.');
    }
});

  
  
app.post("/feed-seen", async (req, res) => {
    try {
        const { id, action } = req.body;
        if (action === 'Seen') {
            await Feedback.findOneAndUpdate({ _id:id }, { seen: 1 });
        }
        res.redirect('/feedback')
    }catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while processing your request.');
    }
});


app.get('/verify/images', async (req, res) => {
    try {
        const { courseCode, date, slot, examType } = req.query;
        const post = await Post.findOne({ courseCode, examDate: date, slot, examType });

        if (post) {
            res.render('verifyImages.ejs', { images: post.images, courseCode, examDate: date, slot, examType });
        } else {
            res.status(404).send('Post not found');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while processing your request.');
    }
});


//Downloading
app.post('/download', async (req, res) => {
    try {
        const { courseCode, examDate, slot } = req.body;
        const post = await Post.findOne({ courseCode, examDate, slot });

        if (post && post.images.length > 0) {
            const doc = new PDFDocument();

            const pdfFileName = `${courseCode}_${examDate}_${slot}.pdf`;
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${pdfFileName}`);

            doc.pipe(res);

            for (const imageUrl of post.images) {
                if (imageUrl) {

                    // Download the image and embed it in the PDF using axios
                    try {
                        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                        if (response.status === 200) {
                            const imageBuffer = response.data;

                            // Embed the image in the PDF with auto scaling to fit the page
                            doc.image(imageBuffer,0,0, {
                                fit: [doc.page.width, doc.page.height],
                                align: 'center',
                                valign: 'center',
                            });
                            doc.addPage();
                        } else {
                            console.error(`Failed to download image: HTTP ${response.status}`);
                        }
                    } catch (error) {
                        console.error(`Error downloading image: ${error.message}`);
                    }
                }
            }

            // Finalize the PDF and send it to the response
            doc.end();

            const down = await Download.findOne();
            let currentDownloads = 1;

            if (down) {
                currentDownloads = down.totalDownloads;
                currentDownloads = currentDownloads + 1;
            }
            if (down) {
                down.totalDownloads = currentDownloads;
                await down.save();
            } else {
                await Download.create({ totalDownloads: currentDownloads });
            }

        } else {
            res.status(404).send('Post not found or has no images.');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while processing your request.');
    }
});

//Display 
app.get('/display', async (req, res) => {
    try {
        const query = req.query;
        const posts = await Post.find(query);
        res.render('display.ejs', { posts });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while processing your request.');
    }
});


app.get('/display/images', async (req, res) => {
    try {
        const { courseCode, date, slot } = req.query;
        const post = await Post.findOne({ courseCode, examDate: date, slot });
        
        if (post) {
            res.render('displayImages.ejs', { images: post.images, courseCode, examDate: date, slot});
        } else {
            res.status(404).send('Post not found');
        }

    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while processing your request.');
    }
});

app.post('/feedback', async (req, res) => {
    try{
        const { name, registration, rating, other} = req.body;
        const feed = new Feedback({
            name: name,
            regdNumber: registration,
            rating: rating,
            feedback: other,
            seen:0,
        });
        await feed.save();
        res.redirect("/");
    }
    catch (error){
        console.error(error);
        res.status(500).send("An error occured when sending the feedback.");
    }
});

app.get('/getUniqueCourseCodes', async (req, res) => {
    try {
        const uniqueCourseCodes = await Post.distinct('courseCode');
        const courseDetails = await Promise.all(uniqueCourseCodes.map(async (code) => {
            // Query the Course collection for course name based on course code
            const course = await Course.findOne({ courseCode: code });

            // If course is found, return "CourseCode(CourseName)"; otherwise, "CourseCode(None)"
            return `${code} (${course ? course.courseName : 'None'})`;
        }));

        // Send response JSON with course details
        res.json(courseDetails);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while fetching unique course codes.' });
    }
});

app.get('/updatecourse', async (req, res) => {
    try {
        const uniqueCourseCodes = await Post.distinct('courseCode');
        for (const courseCode of uniqueCourseCodes) {
            const existingCourse = await Course.findOne({ courseCode });
            if (!existingCourse) {
                await Course.create({ courseCode, courseName: null });
            }
        }
        res.redirect('/updatecoursemain');

    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/updatecoursemain', async (req, res) => {
    try {
        const allCourses = await Course.find({ courseName: null }).select('courseCode courseName');
        // console.log(allCourses);
        res.render('updatecourse.ejs', { allCourses });

    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/uploadCourse', async (req, res) => {
    try{
        const { courseCode, courseName } = req.body;
        Course.findOneAndUpdate(
            { courseCode: courseCode }, 
            { courseName: courseName },
            { new: true, upsert: true }
        )
        .then(updatedCourse => {
            res.redirect('/updatecoursemain');
        })
    } catch(error){
        res.status(500).json({ error: 'Internal server error' });
    }
})

app.use(express.static('public'));
app.set('view engine', 'ejs');

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
