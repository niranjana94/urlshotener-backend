const express = require('express');
const app = express();
const mongodb = require('mongodb');
const mongoclient = mongodb.mongoclient;
const url = "mongodb+srv://m001-student:8FVGTLPp6xBplNdw@sandbox.pzv6n.mongodb.net?retryWrites=true&w=majority"
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const cors = require('cors')
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
app.use(bodyParser.json())
require('dotenv').config();

app.use(cors({
    origin: "*"
}))

app.post('/generate', async function (req, res) {
    try {
        var client = await MongoClient.connect(url, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        //let client = await MongoClient.connect(url);
        let db = client.db('urlgenrator');
        let check = await db.collection('urls').findOne({ fullURL: req.body.fullurl });
        if (check) {
            client.close();
        }
        else {
            //console.log('insert');
            let urldet = await db.collection('urls').insertOne({
                fullURL: req.body.fullurl,
                shortURL: generateUrl(),
                clickcount: 0
            })
            client.close();
            console.log(urldet);
            res.json({

                message: 'success',
                id: urldet.insertedId
            });
        }
    } catch (error) {
        console.log(error);
        res.json({
            message: "Something went wrong"
        })
    }

})

app.get('/showurls', async function (req, res) {
    try {
        var client = await MongoClient.connect(url, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        //let client = await MongoClient.connect(url);
        let db = client.db('urlgenrator');
        let urldet = await db.collection('urls').find({}, { fullURL: 1, shortURL: 1, clickcount: 1, _id: 0 }).toArray()
        client.close();
        res.json(urldet);
    } catch (error) {
        console.log(error);
        res.json({
            message: "Something went wrong"
        })
    }

})

app.get('/:id', async function (req, res) {
    try {
        var client = await MongoClient.connect(url, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        //let client = await MongoClient.connect(url);
        let db = client.db('urlgenrator');

        let shorturl = await db.collection('urls').findOne({ _id: mongodb.ObjectID(req.params.id) });
        client.close();
        res.json(shorturl);
    } catch (error) {
        console.log(error);
        res.json({
            message: "Something went wrong"
        })
    }

})

app.get('/shorturl/:shorturl', async function (req, res) {
    try {
        var client = await MongoClient.connect(url, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        //let client = await MongoClient.connect(url);
        let db = client.db('urlgenrator');

        let urldet = await db.collection('urls').findOne({ shortURL: req.params.shorturl });

        await db.collection('urls').findOneAndUpdate({ _id: urldet._id }, { $inc: { clickcount: 1 } })
        client.close();
        res.redirect(urldet.fullURL)
        //res.json({fullurl:urldet.fullURL});
    } catch (error) {
        console.log(error);
        res.json({
            message: "Something went wrong"
        })
    }

})

app.post('/createuser', async function (req, res, next) {
    try {
        var client = await MongoClient.connect(url, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        //let client = await MongoClient.connect(url);
        let db = client.db('urlgenrator');
        let user = await db.collection('users').findOne({ email: req.body.email });

        if (user) {
            res.json({
                message: 'Email already exists'
            })
        }
        else {
            //console.log('insert');
            let urls = [];
            let salt = bcrypt.genSaltSync(10);
            let hashpswd = bcrypt.hashSync(req.body.password, salt);
            req.body.password = hashpswd;
            let activationKeydet = Math.random().toString(20).substr(2, 15);
            console.log(activationKeydet);
            let userdet = await db.collection('users').insertOne({
                username: req.body.username,
                email: req.body.email,
                password: req.body.password,
                urls,
                verified: false,
                activationkey :activationKeydet
            })
            console.log(activationKeydet);
            let mail = sendmail(req.body.email, 'activationkey', activationkeydet)
           // client.close();

            res.json({

                message: 'Activation key sent to your email id.Please check ',

            });
        }
    } catch (error) {
        console.log(error);
        res.json({
            message: "Something went wrong"
        })
    }

})

let sendmail = async (email, key, activationKey) => {
    console.log(activationKey);
    try {
        var transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.mailuser,
                pass: process.env.pass
            }
        });

        var mailOptions = {

            to: email,
            subject: 'Activating link',
            text: `http://127.0.0.1:5500/activate.html?${key}?=${activationKey}`
        };

        await transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
    }

catch (error) {
    console.log(error);
}
}

app.put("/activationkey",async function (req, res, next) {
    try {
        var client = await MongoClient.connect(url, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        //let client = await MongoClient.connect(url);
        let db = client.db('urlgenrator');
        let user = await db.collection('users').findOne({
            activationKey: req.body.activationkey
        }); 

        let token = jwt.sign({id : user.email}, "secret key");

        let userInfo = await db.collection("users").findOneAndUpdate({
            activationKey: req.body.activationkey
        }, {
            $set: {
                activated: true,
               // token : token
            },
            $unset: {
                activationKey: ""
            }
        });
        client.close();

        if (userInfo.value) {
            res.json({                
                message: "Activated",
                token
            })
            localStorage.setItem('token',token);
        } else {
            res.json({                
                message: "Invalid URL"
            })
        }
    } catch (error) {
        console.log(error);
    }
});

app.listen(process.env.PORT || 3030, function () {
    console.log('server started');
});

function generateUrl() {
    var rndResult = "";
    var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;

    for (var i = 0; i < 6; i++) {
        rndResult += characters.charAt(
            Math.floor(Math.random() * charactersLength)
        );
    }
    console.log(rndResult)
    return rndResult
}
