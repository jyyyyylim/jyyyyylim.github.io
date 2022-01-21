"use strict";


//rebuilding from bias to x and y-vel
//space assumed to be frictionless
//yvel added to initial sum?
//xvel assumed to be 0 excludign starting bias

//initialize vars for canvas drawing
var canvasContext = null;
var canvasElement = null;
var particleArray = [];
var Cursor = [];
var m1down = true;

//init constants
const cursorRadius = 10;
const offsetX = Math.sqrt(cursorRadius);
const offsetY = Math.sqrt(cursorRadius);
const nodeActivationDistance= (window.innerWidth*window.innerHeight)**0.385;
const bounceCoeff = 1.03;
const deviationThreshold = 0.1;

const cullThresholdX = window.innerWidth;
const cullThresholdY = window.innerHeight;


//calc max particles exist (ratio between desired amount/screen space)
const maxParticles = window.innerWidth/10;

//update position array
onmousemove = function(m){Cursor.xpos = m.clientX; Cursor.ypos = m.clientY;}

//equations for the simulation
function opacityScale(s) {return 0.7-(1/s)}
function nodeDistancetoMouse(x, y) {return Math.abs(Math.sqrt(((x-Cursor.xpos)**2)+((y-Cursor.ypos)**2)));}
function randrange(m, n){return Math.random()*(n - m) + m;}
function xvelRelativetoCursor(xpos) {return Cursor.xpos-xpos;}
function yvelRelativetoCursor(ypos) {return Cursor.ypos-ypos;}
function bitwiseFlip(n) {return ~n+1;}
function hypotenuse(a, b) {return Math.sqrt((a**2)+(b**2))}

function initializeCanvas(){
    canvasElement = document.getElementById("simulation")
    canvasContext = canvasElement.getContext("2d");
    window.requestAnimationFrame(mousemixed);
}




//recursive main loop for frame compositing
function risingAshes(){

        //skip particle spawning- a fix to counter V8 flooding the page with particles if focus is returned 
    //setInterval(function() {if (Math.random() <= 0.8 && particleArray.length < 100) {particleArray.push({x:randrange(0,window.innerWidth),y:window.innerHeight,xvel:randrange(-1,1),size:randrange(2,8),power:randrange(3,10)});}},10);
    //alter: use x and y-components instead of xvel
    setInterval(function() {
        if (Math.random() <= 0.8 && particleArray.length < maxParticles) {
            particleArray.push({

                x:randrange(0,window.innerWidth),
                y:window.innerHeight,
                xvel:randrange(-0.05,0.05),
                yvel:2,
                size:randrange(1,5)
            
            });}}
            ,1);

    let canvasitem = document.querySelector("canvas");

    //define drawable region
    canvasElement.width = canvasitem.offsetWidth;
    canvasElement.height = canvasitem.offsetHeight;

    //constants for draw
    canvasContext.fillStyle = "white";
    canvasContext.strokeStyle = "white";
    canvasContext.lineWidth = 1;

    //no fuck you sir i will never use 12pt
    canvasContext.font = "0.6rem times new roman";

    for(var i=0; i < particleArray.length; i++){
        particleArray[i].x += particleArray[i].xvel;

        if (Math.random() <= 0.1) {particleArray[i].xvel -= randrange(-1,1);}
        if (particleArray[i].x < 0 || particleArray[i].x > window.innerWidth) {
            particleArray[i].xvel = bitwiseFlip(particleArray[i].xvel);
        }

        //>"ash particle" draw routine
        canvasContext.beginPath();
        canvasContext.rect(particleArray[i].x, particleArray[i].y, particleArray[i].size, particleArray[i].size);
        
        //simulate "decay"
        particleArray[i].size -= 0.015;
        //cull particles with downward velocity
        if (particleArray[i].size < 0){particleArray.splice(i,1);}

        canvasContext.fill();


        //>experimental proximity draw
        //physics block
        var distBuffer = nodeDistancetoMouse(particleArray[i].x, particleArray[i].y);

        if (distBuffer > nodeActivationDistance) {
            //executed when mouse ypos is above particle
            particleArray[i].y += particleArray[i].size*-0.8;

        } else {
            //executed when mouse ypos is below particle
            particleArray[i].xvel -= xvelRelativetoCursor(particleArray[i].x, particleArray[i].y)/800;

            if (Cursor.ypos > particleArray[i].y){
                particleArray[i].y += particleArray[i].size*-0.9;
            } else {
                particleArray[i].y += particleArray[i].size*-0.4;
            }

            canvasContext.strokeStyle = "rgba(255, 255, 255," + opacityScale(particleArray[i].size) + ")";
            
            //start draw routine for "node paths"
            //canvasContext.beginPath();
            //canvasContext.moveTo(Cursor.xpos - offsetX, Cursor.ypos + offsetY);
            //canvasContext.lineTo(particleArray[i].x + (particleArray[i].size / 2), particleArray[i].y + (particleArray[i].size));
            canvasContext.fillText((Math.floor(distBuffer)), particleArray[i].x+10, particleArray[i].y+10);

            //canvasContext.stroke();
        }
        

    }

    canvasContext.strokeStyle = "white";
    //>draw routine for cursor
    canvasContext.beginPath(); 
    canvasContext.arc(Cursor.xpos - offsetX, Cursor.ypos + offsetY, cursorRadius, 0, 2*Math.PI);
    canvasContext.stroke();

    canvasContext.beginPath(); 
    canvasContext.arc(Cursor.xpos - offsetX, Cursor.ypos + offsetY, nodeActivationDistance, 0, 2*Math.PI);
    canvasContext.stroke();

    //frame is finally advanced when all DRAW procedures go through
    window.requestAnimationFrame(risingAshes);
}

function mousetests(){

    setInterval(function() {
        if (Math.random() <= 0.8 && particleArray.length < maxParticles*1.5) {
            particleArray.push({x: randrange(0,window.innerWidth), y: randrange(0,window.innerHeight), xvel: 0, yvel: 0, size: randrange(3,7)});}},1);

    let canvasitem = document.querySelector("canvas");
    //define drawable region
    canvasElement.width = canvasitem.offsetWidth;
    canvasElement.height = canvasitem.offsetHeight;

    //constants for draw
    canvasContext.fillStyle = "white";
    canvasContext.strokeStyle = "white";
    canvasContext.lineWidth = 1;

    canvasContext.font = "0.6rem times new roman";

    for(var i=0; i < particleArray.length; i++){

        //handle bounce 
        //makes cull unneccessary since particles are always kept within bounds
        if (particleArray[i].x < 0 || particleArray[i].x > window.innerWidth) {particleArray[i].xvel = bitwiseFlip(particleArray[i].xvel*bounceCoeff);}
        if (particleArray[i].y < 0 || particleArray[i].y > window.innerHeight) {particleArray[i].yvel = bitwiseFlip(particleArray[i].yvel*bounceCoeff);}
        
        //handle movement
        if (particleArray[i].xvel != 0) {particleArray[i].x += particleArray[i].xvel/particleArray[i].size;}
        if (particleArray[i].yvel != 0) {particleArray[i].y += particleArray[i].yvel/particleArray[i].size;}

        
        //velocity decay boilerplate
        if (particleArray[i].xvel < 0) {particleArray[i].xvel += 0.4;}
        else if (particleArray[i].xvel > 0) {particleArray[i].xvel -= 0.4;}
        if (Math.abs(particleArray[i].xvel) < deviationThreshold) {particleArray[i].xvel = 0;}

        if (particleArray[i].yvel < 0) {particleArray[i].yvel += 0.4;}
        else if (particleArray[i].yvel > 0) {particleArray[i].yvel -= 0.4;}
        if (Math.abs(particleArray[i].yvel) < deviationThreshold) {particleArray[i].yvel = 0;}

        //calculate cursor repulsive force
        var distBuffer = nodeDistancetoMouse(particleArray[i].x, particleArray[i].y);
        if (distBuffer < nodeActivationDistance) {
            particleArray[i].xvel -= xvelRelativetoCursor(particleArray[i].x)/40;
            particleArray[i].yvel -= yvelRelativetoCursor(particleArray[i].y)/40;
        }
        
        //draw routine
        canvasContext.beginPath();
        canvasContext.rect(particleArray[i].x, particleArray[i].y, particleArray[i].size, particleArray[i].size);
        canvasContext.fill();
        //canvasContext.beginPath(); 
        //canvasContext.arc(Cursor.xpos - offsetX, Cursor.ypos + offsetY, nodeActivationDistance, 0, 2*Math.PI);
        //canvasContext.stroke();
        //canvasContext.fillText("s: " + Math.floor(particleArray[i].size) + " | v: " + Math.floor(hypotenuse(particleArray[i].xvel, particleArray[i].yvel)), particleArray[i].x+10, particleArray[i].y+10);
    }    
    window.requestAnimationFrame(mousetests);
}

function inversemouse(){

    setInterval(function() {
        if (Math.random() <= 0.8 && particleArray.length < maxParticles*2) {
            particleArray.push({x:randrange(0,window.innerWidth),y:randrange(0,window.innerHeight),xvel:0,yvel:0,size:randrange(3,7)});}},1);

    let canvasitem = document.querySelector("canvas");

    //define drawable region
    canvasElement.width = canvasitem.offsetWidth;
    canvasElement.height = canvasitem.offsetHeight;

    //constants for draw
    canvasContext.fillStyle = "white";
    canvasContext.strokeStyle = "white";
    canvasContext.lineWidth = 1;

    canvasContext.font = "0.6rem times new roman";

    for(var i=0; i < particleArray.length; i++){

        //handle bounce 
        //makes cull unneccessary since particles are always kept within bounds
        if (particleArray[i].x < 0 || particleArray[i].x > window.innerWidth) {particleArray[i].xvel = bitwiseFlip(particleArray[i].xvel*bounceCoeff);}
        if (particleArray[i].y < 0 || particleArray[i].y > window.innerHeight) {particleArray[i].yvel = bitwiseFlip(particleArray[i].yvel*bounceCoeff);}
        
        //handle movement
        if (particleArray[i].xvel != 0) {particleArray[i].x += particleArray[i].xvel/particleArray[i].size;}
        if (particleArray[i].yvel != 0) {particleArray[i].y += particleArray[i].yvel/particleArray[i].size;}


        
        //velocity decay boilerplate
        if (particleArray[i].xvel < 0) {particleArray[i].xvel += 0.4;}
        else if (particleArray[i].xvel > 0) {particleArray[i].xvel -= 0.4;}
        if (Math.abs(particleArray[i].xvel) < deviationThreshold) {particleArray[i].xvel = 0;}

        if (particleArray[i].yvel < 0) {particleArray[i].yvel += 0.4;}
        else if (particleArray[i].yvel > 0) {particleArray[i].yvel -= 0.4;}
        if (Math.abs(particleArray[i].yvel) < deviationThreshold) {particleArray[i].yvel = 0;}
        

        //calculate cursor attraction force
        var distBuffer = nodeDistancetoMouse(particleArray[i].x, particleArray[i].y);
        if (distBuffer < nodeActivationDistance) {
            particleArray[i].xvel += xvelRelativetoCursor(particleArray[i].x)/30;
            particleArray[i].yvel += yvelRelativetoCursor(particleArray[i].y)/30;
        }
        
        //draw routine
        canvasContext.beginPath();
        canvasContext.rect(particleArray[i].x, particleArray[i].y, particleArray[i].size, particleArray[i].size);
        canvasContext.fill();
        canvasContext.beginPath(); 
        canvasContext.arc(Cursor.xpos - offsetX, Cursor.ypos + offsetY, nodeActivationDistance, 0, 2*Math.PI);
        canvasContext.stroke();
        //canvasContext.fillText("s: " + Math.floor(particleArray[i].size) + " | v: " + Math.floor(hypotenuse(particleArray[i].xvel, particleArray[i].yvel)), particleArray[i].x+10, particleArray[i].y+10);

    }    
    window.requestAnimationFrame(inversemouse);
}


function mousemixed(){

    setInterval(function() {
        if (Math.random() <= 0.8 && particleArray.length < maxParticles*1.5) {
            particleArray.push({x: randrange(0,window.innerWidth), y: randrange(0,window.innerHeight), xvel: 0, yvel: 0, size: randrange(3,7)});}},1);

    var canvasitem = document.querySelector("canvas");
    var context = document.querySelector("body");

    context.onmousedown = function(){m1down = !m1down;console.log("bye");}
    context.onmouseup = function(){m1down = !m1down; console.log("hi");}

    //define drawable region
    canvasElement.width = canvasitem.offsetWidth;
    canvasElement.height = canvasitem.offsetHeight;

    //constants for draw
    canvasContext.fillStyle = "white";
    canvasContext.strokeStyle = "rgba(255, 255, 255, 0.03)";
    canvasContext.lineWidth = 1;

    canvasContext.font = "0.6rem times new roman";

    for(var i=0; i < particleArray.length; i++){

        //handle bounce 
        //makes cull unneccessary since particles are always kept within bounds
        if (particleArray[i].x < 0 || particleArray[i].x > window.innerWidth) {particleArray[i].xvel = bitwiseFlip(particleArray[i].xvel*bounceCoeff);}
        if (particleArray[i].y < 0 || particleArray[i].y > window.innerHeight) {particleArray[i].yvel = bitwiseFlip(particleArray[i].yvel*bounceCoeff);}
        
        //handle movement
        if (particleArray[i].xvel != 0) {particleArray[i].x += particleArray[i].xvel/particleArray[i].size;}
        if (particleArray[i].yvel != 0) {particleArray[i].y += particleArray[i].yvel/particleArray[i].size;}

        //bugfix: particles going above a certain speed get their velocity compounded by bounceCoeff on every loop
        if (Math.abs(particleArray[i].xvel) > cullThresholdX) {particleArray.splice(i,1);}
        if (Math.abs(particleArray[i].yvel) > cullThresholdY) {particleArray.splice(i,1);}

        
        //velocity decay boilerplate
        if (particleArray[i].xvel < 0) {particleArray[i].xvel += 0.4;}
        else if (particleArray[i].xvel > 0) {particleArray[i].xvel -= 0.4;}
        if (Math.abs(particleArray[i].xvel) < deviationThreshold) {particleArray[i].xvel = 0;}

        if (particleArray[i].yvel < 0) {particleArray[i].yvel += 0.4;}
        else if (particleArray[i].yvel > 0) {particleArray[i].yvel -= 0.4;}
        if (Math.abs(particleArray[i].yvel) < deviationThreshold) {particleArray[i].yvel = 0;}

        //calculate cursor repulsive force
        var distBuffer = nodeDistancetoMouse(particleArray[i].x, particleArray[i].y);
        if (m1down == true){
            if (distBuffer < nodeActivationDistance) {
                particleArray[i].xvel -= xvelRelativetoCursor(particleArray[i].x)/35;
                particleArray[i].yvel -= yvelRelativetoCursor(particleArray[i].y)/35;
            }
        } else {
            if (distBuffer < nodeActivationDistance) {
                particleArray[i].xvel += xvelRelativetoCursor(particleArray[i].x)/35;
                particleArray[i].yvel += yvelRelativetoCursor(particleArray[i].y)/35;
                canvasContext.beginPath(); 
                canvasContext.arc(Cursor.xpos - offsetX, Cursor.ypos + offsetY, nodeActivationDistance, 0, 2*Math.PI);
                canvasContext.stroke();
            }
        } 
        
        //draw routine
        canvasContext.beginPath();
        canvasContext.rect(particleArray[i].x, particleArray[i].y, particleArray[i].size, particleArray[i].size);
        canvasContext.fill();

        //canvasContext.fillText("s: " + Math.floor(particleArray[i].size) + " | v: " + Math.floor(hypotenuse(particleArray[i].xvel, particleArray[i].yvel)), particleArray[i].x+10, particleArray[i].y+10);
    }    
    window.requestAnimationFrame(mousemixed);
}

function smokeCell(){






        setInterval(function() {
        if (Math.random() <= 0.8 && particleArray.length < maxParticles*2) {
            particleArray.push({
                x:randrange(0,window.innerWidth),
                y:randrange(0,window.innerHeight),
                xvel:randrange(-5,5),
                yvel:randrange(-5,5),
                size:randrange(3,7)
            });}},1);
    
            let canvasitem = document.querySelector("canvas");

            //define drawable region
            canvasElement.width = canvasitem.offsetWidth;
            canvasElement.height = canvasitem.offsetHeight;
        
            //constants for draw
            canvasContext.fillStyle = "white";
            canvasContext.strokeStyle = "white";
            canvasContext.lineWidth = 1;    
            canvasContext.font = "0.6rem times new roman";
        
            //iterative simulation loop
            for(var i=0; i < particleArray.length; i++){
                
                
                //handle bounce 
                //makes cull unneccessary since particles are always kept within bounds
                if (particleArray[i].x < 0 || particleArray[i].x > window.innerWidth) {particleArray[i].xvel = bitwiseFlip(particleArray[i].xvel*bounceCoeff);}
                if (particleArray[i].y < 0 || particleArray[i].y > window.innerHeight) {particleArray[i].yvel = bitwiseFlip(particleArray[i].yvel*bounceCoeff);}

                //handle collision
                //brownian motion- assume all collisions are ELASTIC    
                //m1v1+m2v2=m1v1'+m2v2' where v1-v2=-(v1'-v2')


                
                //handle movement
                particleArray[i].x += particleArray[i].xvel/particleArray[i].size;
                particleArray[i].y += particleArray[i].yvel/particleArray[i].size;
        
                //decay..?
                if (particleArray[i].xvel < 0) {particleArray[i].xvel += 0.4;}
                else if (particleArray[i].xvel > 0) {particleArray[i].xvel -= 0.4;}
                if (particleArray[i].yvel < 0) {particleArray[i].yvel += 0.4;}
                else if (particleArray[i].yvel > 0) {particleArray[i].yvel -= 0.4;}        
        
                //calculate cursor repulsive force
                var distBuffer = nodeDistancetoMouse(particleArray[i].x, particleArray[i].y);
                if (distBuffer < nodeActivationDistance) {
                    particleArray[i].xvel -= xvelRelativetoCursor(particleArray[i].x)/50;
                    particleArray[i].yvel -= yvelRelativetoCursor(particleArray[i].y)/50;
                }
                
                //draw routine
                canvasContext.beginPath();
                canvasContext.rect(particleArray[i].x, particleArray[i].y, particleArray[i].size, particleArray[i].size);
                canvasContext.fill();
                canvasContext.beginPath(); 
                canvasContext.arc(Cursor.xpos - offsetX, Cursor.ypos + offsetY, nodeActivationDistance, 0, 2*Math.PI);
                canvasContext.stroke();
                canvasContext.fillText("s: " + Math.floor(particleArray[i].size) + " | v: " + Math.floor(hypotenuse(particleArray[i].xvel, particleArray[i].yvel)), particleArray[i].x+10, particleArray[i].y+10);
        
            }    
    window.requestAnimationFrame(smokeCell);

}


console.log("success!");
