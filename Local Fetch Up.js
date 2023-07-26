// puppeteerTask.js
const puppeteer = require('puppeteer');
const ConstantKeys = require('./ConstantKeys');
const { fetchEwbNumbersLocal, updateDataLocal } = require('./database.js');

(async () => {
  const userDataDir = 'C:\\Users\\anike\\Desktop\\Python Projects\\User Data\\Local Fetch UP';

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized'],
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Path to your Chrome executable
    userDataDir, // Specify the user data directory for the Puppeteer browser
  });
  const pages = await browser.pages();
  const page = pages[0];

  let isPageLoaded = false;

  do {
    try {
      await page.goto(ConstantKeys.ConstantKeys.LOGIN_URL, { waitUntil: 'networkidle2' });
      isPageLoaded = true;
    } catch (error) {
      console.error('Page failed to load. Please manually refresh the page.');
      await page.waitForTimeout(1000);
    }
  } while (!isPageLoaded);

  const navigationPromise = page.waitForNavigation({ timeout: 0 });

  // Fill username field
  await page.evaluate((username) => {
    const usernameField = document.querySelector('input[placeholder="Username"]');
    usernameField.value = username;
  }, ConstantKeys.ConstantKeys.LOGIN_USERNAME_UP);

  // Fill password field
  await page.evaluate((password) => {
    const passwordField = document.querySelector('input[placeholder="Password"]');
    passwordField.value = password;
  }, ConstantKeys.ConstantKeys.LOGIN_PASSWORD_UP);

  // Submit the form
  await page.evaluate(() => {
    const submitButton = document.querySelector('input#btnLogin');
    submitButton.click();
  });

  // Handle alert dialog
  page.on('dialog', async (dialog) => {
    console.log(`Dialog message: ${dialog.message()}`);
    await dialog.accept();
  });

  // Wait for the page to reload
  await navigationPromise;

  // Wait for a moment before filling the form again
  await page.waitForTimeout(2000);

  // Fill username field again
  await page.evaluate((username) => {
    const usernameField = document.querySelector('input[placeholder="Username"]');
    usernameField.value = username;
  }, ConstantKeys.ConstantKeys.LOGIN_USERNAME_UP);

  // Fill password field again
  await page.evaluate((password) => {
    const passwordField = document.querySelector('input[placeholder="Password"]');
    passwordField.value = password;
  }, ConstantKeys.ConstantKeys.LOGIN_PASSWORD_UP);

  console.log('Please click the login button manually and wait for the page to load.');

  await page.waitForNavigation();

  // Fetch c_ewbNumbers from the database
  const results = await fetchEwbNumbersLocal();

  // Process each c_ewbNumber
  for (const data of results) {
    const c_ewbNumber = data.c_ewbNumber;

    await page.goto('https://ewaybillgst.gov.in/BillGeneration/EBPrint.aspx');
    await page.evaluate((data) => {
      const inputField = document.querySelector('#ctl00_ContentPlaceHolder1_txt_ebillno');
      inputField.value = data;
    }, c_ewbNumber);

    await page.evaluate(() => {
      const button = document.querySelector('#ctl00_ContentPlaceHolder1_btn_go');
      button.click();
    });
    await page.waitForNavigation();

    const updatedData = await page.evaluate(() => {
      // Extract the Kms data from the ctl00_ContentPlaceHolder1_lblValidFrom element
      const kmsElement = document.querySelector('#ctl00_ContentPlaceHolder1_lblValidFrom');
      const kmsText = kmsElement?.textContent.trim() || '';
      const regex = /\[(\d+)Kms\]/;
      const kmsMatch = regex.exec(kmsText);
      const kms = kmsMatch ? kmsMatch[1] : '';

      const supplierElement = document.querySelector('#ctl00_ContentPlaceHolder1_lbl_gstnSupplier');
      const supplierValue = supplierElement ? supplierElement.textContent.split(',')[0]?.trim() || '' : '';
      const supplierNameValue = supplierElement ? supplierElement.textContent.split(',')[1]?.trim() || '' : '';

      const recipientElement = document.querySelector('#ctl00_ContentPlaceHolder1_txtSypplyTo');
      const recipientValue = recipientElement ? recipientElement.textContent.split(',')[0]?.trim() || '' : '';
      const recipientNameValue = recipientElement ? recipientElement.textContent.split(',')[1]?.trim() || '' : '';

      const placeOfDeliveryElement = document.querySelector('#ctl00_ContentPlaceHolder1_lblDeli');
      const documentNumberElement = document.querySelector('#ctl00_ContentPlaceHolder1_lblDocDet');
      const documentDateElement = document.querySelector('#ctl00_ContentPlaceHolder1_lblDocDt');
      const totalValueElement = document.querySelector('#ctl00_ContentPlaceHolder1_lblVG');
      const hsnCodeElement = document.querySelector('#ctl00_ContentPlaceHolder1_lblhsncode');
      const ewbExpiryDateElement = document.querySelector('#ctl00_ContentPlaceHolder1_lblValidTo');
      const transactionTypeElement = document.querySelector('#ctl00_ContentPlaceHolder1_lblTransType');

      const ewbExpiryDateText = ewbExpiryDateElement?.textContent.trim() || '';
  const ewbExpiryDateRegex = /\d{2}\/\d{2}\/\d{4}/;
  const ewbExpiryDateMatch = ewbExpiryDateRegex.exec(ewbExpiryDateText);

  let ewbExpiryDate = '';
  if (ewbExpiryDateMatch) {
    const [month, day, year] = ewbExpiryDateMatch[0].split('/');
    ewbExpiryDate = `${month}-${day}-${year}`;
      }

      const updatedData = {
        c_kms: kms,
        c_ewbExpiryDate: ewbExpiryDate,
        c_supplierName: supplierNameValue,
        c_supplier: supplierValue,
        c_recipient: recipientValue,
        c_recipientName: recipientNameValue,
        c_placeOfDelivery: placeOfDeliveryElement?.textContent.trim() || '',
        c_transactionType: transactionTypeElement?.textContent.trim() || '',
        c_documentNumber: documentNumberElement?.textContent.trim() || '',
        c_documentDate: documentDateElement?.textContent.trim() || '',
        c_totalValue: totalValueElement?.textContent.trim() || '',
        c_hsnCode: hsnCodeElement?.textContent.trim() || ''
      };

      return updatedData;
    });

    console.log('Updated data:', updatedData);

    try {
      await updateDataLocal(updatedData, c_ewbNumber);
      console.log('Data updated successfully');
    } catch (error) {
      console.error('Error updating data:', error);
    }
  }

  await browser.close();
})();
