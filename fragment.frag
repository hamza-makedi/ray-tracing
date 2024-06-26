#version 330 core


#define PI 3.14159265
#define TAU (2*PI)

out vec4 fragColor;

uniform float screenWidth;
uniform float screenHeight;

uniform float mouseX;
uniform float mouseY;

uniform float time;

vec2 mousePos = vec2(mouseX, mouseY);
vec2 Resolution = vec2(screenWidth, screenHeight);

//define some constante
const float FOV = 1.0;
const int MAX_STEPS = 256;
const float MAX_DIST = 500;
const float EPSILON = 0.001;

vec3 getMaterial(vec3 p, float id){
    vec3 m;
    switch(int(id)){
        case 1:
        m = vec3(0.2 + 0.4 * mod(floor(p.x)+floor(p.z), 2.0)); break;
        case 2 :
        m = vec3(0.9, 0.9, 0.0); break;
        case 3 :
        m = vec3(5., 0.0, 0.0); break;
        case 4 :
        m = vec3(0.0, 0.0, 0.7); break;
    }
    return m;
}

////////////////////////////////////////////
//SDF functions
//you can find all this functions here >>> https://mercury.sexy/hg_sdf/ <<<

//SDF sphere
float fSphere(vec3 p, vec3 center, float r) {
    return length(p - center) - r;
}

// Plane with normal n (n is normalized) at some distance from the origin
float fPlane(vec3 p, vec3 n, float distanceFromOrigin) {
    return dot(p, n) + distanceFromOrigin;
}

// Repeat in three dimensions
vec3 pMod3(inout vec3 p, vec3 size) {
    vec3 c = floor((p + size*0.5)/size);
    p = mod(p + size*0.5, size) - size*0.5;
    return c;
}

// Rotate around a coordinate axis (i.e. in a plane perpendicular to that axis) by angle <a>.
// Read like this: R(p.xz, a) rotates "x towards z".
// This is fast if <a> is a compile-time constant and slower (but still practical) if not.
void pR(inout vec2 p, float a) {
    p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}

/////////////////////////////////////////////

//Union finction
vec2 fOpUnionID(vec2 res1, vec2 res2){
    return (res1.x < res2.x) ? res1 : res2 ;
}


vec2 map(vec3 p){   
    //plane
    float planeDIST = fPlane(p, vec3(0,1,0), 1.0);
    float planeID = 1.0;
    vec2 plane = vec2(planeDIST, planeID);

    //yellow sphere
    vec3 spherePos1 = vec3(0,abs(sin(time)*1.5),0);
    float sphereDIST1 = fSphere(p,spherePos1, 1.0);
    float sphereID1 = 2.0;
    vec2 sphere1 = vec2(sphereDIST1, sphereID1);

    //red sphere
    vec3 spherePos2 = vec3(2.5,abs(sin(time+5)),0);
    float sphereDIST2 = fSphere(p,spherePos2, 0.5);
    float sphereID2 = 3.0;
    vec2 sphere2 = vec2(sphereDIST2, sphereID2);

    //bleu sphere
    vec3 spherePos3 = vec3(-2.5,abs(sin(time+2)*1.2),0);
    float sphereDIST3 = fSphere(p,spherePos3, 0.8);
    float sphereID3 = 4.0;
    vec2 sphere3 = vec2(sphereDIST3, sphereID3);

    //result
    vec2 res = fOpUnionID(fOpUnionID(fOpUnionID(sphere1,plane),sphere2),sphere3);
    return res;
}

//the actual ray march algorithm 
//this function returns a vec2 where the x is the distance and y is the color

vec2 rayMarch(vec3 rayOrigin, vec3 rayDir){

    vec2 hit,object;

    for(int i=0 ;i < MAX_STEPS; i++){

        vec3 p = rayOrigin + object.x * rayDir;
        hit = map(p);

        object.x += hit.x;
        object.y = hit.y;

        if(abs(hit.x) < EPSILON || object.x > MAX_DIST) break; 
    }
    return object;
}

//cheap Normal calculation
vec3 getNormal(vec3 p){
    vec2 e = vec2(EPSILON, 0.0);
    vec3 n = vec3(map(p).x) - vec3(map(p - e.xyy).x , map(p - e.yxy).x , map(p - e.yyx).x );
    return normalize(n);
}
//shadow functions
//>>>> https://iquilezles.org/articles/rmshadows/   <<<<
float shadow( vec3 ro, vec3 rd, float mint, float maxt )
{
    float t = mint;
    for( int i=0; i<256 && t<maxt; i++ )
    {
        vec2 h = map(ro + rd*t);
        if( h.x<0.001 )
            return 0.0;
        t += h.x;
    }
    return 1.0;
}

float softshadow(vec3 ro,vec3 rd, float mint, float maxt, float k )
{
    float res = 1.0;
    float t = mint;
    for( int i=0; i<256 && t<maxt; i++ )
    {
        vec2 h = map(ro + rd*t);
        if( h.x<0.001 )
            return 0.0;
        res = min( res, k*h.x/t );
        t += h.x;
    }
    return res;
}

//Lighting the scene
vec3 getLight(vec3 p, vec3 rayDir, vec3 color){
    //lightin using lambert's cosin law
    vec3 lightPos = vec3(10.0, 80.0, -30.0);
    vec3 L = normalize(lightPos - p);
    vec3 N = getNormal(p);
    vec3 V = -rayDir;
    vec3 R = reflect(-L, N);

    vec3 specColor = vec3(0.5);
    vec3 specular = specColor * pow(clamp(dot(R, V), 0.0, 1.0), 10.0);
    vec3 diffuse = color * clamp(dot(L, N) ,0.0 ,1.0);
    vec3 ambient = color * 0.05;

    //shadows 
    //float shadows = shadow(p + N *0.02 , normalize(lightPos),0.0, 1.0);
    float shadows = softshadow(p + N *0.02,normalize(lightPos),.01, 100.0, 2.0);
    if(shadows == 0.0)return ambient; 

    return (diffuse + ambient + specular); 
       
}

//camera position and rotation
mat3 getCamera(vec3 rayOrigin, vec3 lookAt){
    vec3 camF = normalize(vec3(lookAt - rayOrigin));
    vec3 camR = normalize(cross(vec3(0., 1., 0.), camF));
    vec3 camU = cross(camF, camR);
    return mat3(camR, camU, camF);
}

//mouse control
void mouseControl(inout vec3 ro){
    vec2 m = mousePos / Resolution;
    pR(ro.yz, m.y * PI * 0.5 - 0.5);
    pR(ro.xz, m.x * TAU);
}


void render(inout vec3 col,in vec2 uv){
    //define ray origine and normilaized ray direction
    vec3 rayOrigin = vec3(.0, 1.0, -3.0);
    mouseControl(rayOrigin);

    vec3 lookAt = vec3(0., 1., 0.);
    vec3 rayDir = getCamera(rayOrigin,lookAt) * normalize(vec3(uv,FOV));

    vec2 object = rayMarch(rayOrigin, rayDir);

    vec3 background = vec3(0.5, 0.8, 0.9);

    if(object.x < MAX_DIST){
        vec3 p = rayOrigin + object.x * rayDir;
        vec3 material = getMaterial(p, object.y);
        col += getLight(p, rayDir, material);
        //fog effect
        col = mix(col, background, 1.0 - exp(-0.0008 * object.x * object.x) );
    }else{
        col += background - max(0.95 * rayDir.y, 0.0);
    }
}

void main() {
    
    vec2 uv = (gl_FragCoord.xy * 2 - Resolution) / Resolution.y;

    vec3 col;
    render(col,uv);

    //gamma correction (idk what the hell is this i have to look this up)
    col = pow(col,vec3(0.9545));

    fragColor = vec4(col, 1.0);
}
