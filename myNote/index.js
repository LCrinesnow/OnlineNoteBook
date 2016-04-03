/**
 * Created by rinesnow on 16/3/29.
 */
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var crypto = require('crypto');
var session= require('express-session');
var moment = require('moment');
var authentication = require('./authentication.js');



var app = express();


//连接数据库
var mongoose = require('mongoose');
var models = require('./models/models');

var User = models.User;
var Note = models.Note;

mongoose.connect('mongodb://localhost:27017/notes');
mongoose.connection.on('error',console.error.bind(console,'连接数据库失败!'));

//定义EJS模版引擎和末班文件位置
app.set('views', path.join(__dirname,'views'));
app.set('view engine','ejs');

//定义静态文件目录
app.use(express.static(path.join(__dirname,'public')));

//定义数据解析器
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

//建立session模型
app.use(session({
    secret:'liuchong',//?
    name:'mynote',
    //一周内免登录
    cookie:{maxAge:1000 * 60 * 60*24*7},//设置session的保存时间为 60min*24小时*7一周
    resave: false,
    saveUnintiallized:true
}));



//添加  页面提示功能
app.use(function(req, res, next) {
    res.locals.user = req.session.user;//???
    var err = req.session.error;//赋值给err变量,
    //var success = req.session.success;//赋值给err变量,

    delete req.session.error;//然后清空session内的数据
    res.locals.message = '';//初始化
    //res.locals.success = '';//初始化

    if (err) {
        //html通过js被操作,在html中用{%-message%}调用
        res.locals.message = '<div class="alert alert-warning">' + err + '</div>';
    }
    //if (success) {
    //    //html通过js被操作,在html中用{%-message%}调用
    //    res.locals.success = '<div class="alert alert-success">' + success + '</div>';
    //}

    next();//?
});



//响应首页get请求
app.get('/',authentication.ifAuthorized);//检测是否登录了
app.get('/',function(req,res){

    Note.find({author:req.session.user.username}).exec(function(err,allNotes){
        if(err){
            console.log(err);
            return res.redirect('/');
        }
        res.render('index',{
           title:'首页',
            user: req.session.user,
            notes:allNotes
        });
    })
});


///注册

//响应注册页面get请求
app.get('/register',authentication.noReLogin);//不能重复注册了  必须是'/register'因为是针对register的页面的
app.get('/register',function(req,res){
   console.log('注册!');
    res.render('register',{
        //在跳转页面之前，将user信息数据传入EJS模板。
        user: req.session.user,
        title:'注册'
    });
});
//响应注册页面post请求
app.post('/register',function(req,res){
    var username = req.body.username,
       password = req.body.password,
       passwordRepeat = req.body.passwordRepeat;

    if(username.trim().length == 0){
        req.session.error='用户名不能为空!';//传到前面的   页面提示功能
        return res.redirect('/register');
    }
    if(password.trim().length == 0||passwordRepeat.trim().length ==0){
        req.session.error='密码和确认密码不能为空!';//传到前面的   页面提示功能
        return res.redirect('/register');
    }
    if(password !=passwordRepeat){
        req.session.error='两次输入的密码不一致!';//传到前面的   页面提示功能
        return res.redirect('/register');
    }
    //正则判断
    var regUsername =/[^a-zA-Z0-9_]{1,}/;//包含(非法符号) 除大写和小写字母还有数字下划线以外的字符只要出现一次的 [所有{1,}]表达式
    //若满足,则证明不符合要求.
    //console.log(regUsername.test(username));//true 是  是非法符号
    //console.log(username.trim().length<=20);
    //console.log(username.trim().length>=3);
    if(regUsername.test(username)||//要么包含非法符号
         username.trim().length>20||//要么大于20小于3
         username.trim().length<3){
        req.session.error='用户名只能是字母、数字、下划线的组合，长度3-20个字符!';//传到前面的   页面提示功能
        return res.redirect('/register');
    }

    var regPassword1 =/[a-z]{1,}/;// 等价于  /[a-z]+/
    var regPassword2 =/[A-Z]{1,}/;// 等价于  /[A-Z]+/
    var regPassword3 =/[0-9]{1,}/;// 等价于  /[0-9]+/
    //console.log(regPassword1.test(password));
    //console.log(regPassword2.test(password));
    //console.log(regPassword3.test(password));
    //console.log(password.trim().length);

    //若四个里面有一个false则提示
    if(!(regPassword1.test(password)&&
        regPassword2.test(password)&&
        regPassword3.test(password)&&
        password.trim().length>=6)){
        req.session.error='密码长度不能少于6，必须同时包含数字、小写字母、大写字母!';//传到前面的   页面提示功能
        return res.redirect('/register');
    }

    //检查用户名是否已经存在,如果不存在,则保存该条纪录
    User.findOne({username:username},function(err,user){
       if(err){
           console.log(err);
           return res.redirect('/register');
       }
        if(user){
            req.session.error='用户名已经存在!请换个用户名注册';//传到前面的   页面提示功能
            return res.redirect('/register');
        }
        //对密码进行md5加密
        var md5 = crypto.createHash('md5'),
            md5password = md5.update(password).digest('hex');
        //新建user对象用于保存数据
        var newUser = new User({
            username:username,
            password:md5password
        });

        newUser.save(function(err,doc){
            if(err){
                console.log(err);
                return res.redirect('/register');
            }
            //req.session.success='注册成功!';//加个登录链接
            console.log('注册成功!');//怎么实现弹出框!!!!??????
            return res.redirect('/');
        });
    });
});



//登录

//响应登录页面get请求
app.get('/login',authentication.noReLogin);//不能重复登录  //必须是'/login'因为是针对login的页面的
app.get('/login',function(req,res){
   console.log('登录!');
    res.render('login',{
        user: req.session.user,//也要加?
        title:'登录'
    });
});
//响应登录页面post请求
app.post('/login',function(req,res){
    var username = req.body.username, password = req.body.password;
    User.findOne({username:username},function(err,user){
       if(err){
           console.log(err);
           return res.redirect('/login');
       }
        if(!user){
            req.session.error='用户不存在!';//传到前面的   页面提示功能
            return res.redirect('/login');
        }
        var md5 = crypto.createHash('md5'),
                md5password = md5.update(password).digest('hex');
        if(user.password!==md5password) {
            req.session.error = '用户名或密码不正确';//传到前面的   页面提示功能
            return res.redirect('/login');
        }
        console.log('登录成功!');
        //保存session,可以很方便的通过req参数来存储和访问session对象的数据
        user.password = null;//?
        delete  user.password;
        req.session.user = user;
        //req.session是一个JSON格式的JavaScript对象，我们可以在使用的过程中随意的增加成员。
        return res.redirect('/');
    });
});



//登出
app.get('/quit',function(req,res){
    //退出功能只需将session中的user删除即可。
    req.session.user = null;
    console.log('退出!');
    return res.redirect('/login');
});



//发布

//响应发布get请求
app.get('/post',authentication.ifAuthorized);//检测是否登录了
app.get('/post',function(req,res){
   console.log('发布!');
    res.render('post',{
        user: req.session.user,//也要加?
        title:'发布'
    });
});
//响应发布post请求
app.post('/post',function(req,res){
   var note = new Note({
       title:req.body.title,
       author:req.session.user.username,
       tag: req.body.tag,
       content: req.body.content
   });
    note.save(function(err,doc){
       if(err){
           console.log(err);
           return res.redirect('/post');
       }
        console.log('文章发表成功!')
        return res.redirect('/');
    });
});
//


//博客细节

app.get('/detail/',authentication.ifAuthorized);//检测是否登录了
app.get('/detail/:_id',function(req,res){//:id?
   console.log('查看笔记!');
    Note.findOne({_id:req.params._id}).exec(function(err,art){
        if(err){
            console.log(err);
            return res.redirect('/');
        }
        if(art) {
            res.render('detail', {
                title: '笔记详情',
                user: req.session.user,
                art: art,
                moment:moment
            });
        }
    });
});



app.listen(3000, function(req,res){
    console.log('app is running at port 3000');
});