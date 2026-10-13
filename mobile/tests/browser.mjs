import {chromium} from '@playwright/test';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:8081',{waitUntil:'networkidle'});
await page.getByRole('button',{name:'الدخول بحساب ديسكورد'}).waitFor();
if(await page.getByText('استكشف التطبيق').count())throw new Error('Sample data entry point must not exist');
console.log(JSON.stringify({errors}));await browser.close();if(errors.length)process.exitCode=1;
