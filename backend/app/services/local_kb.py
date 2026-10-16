# -*- coding: utf-8 -*-
"""
Structured Local Medical Knowledge Base & Predefined FAQs for Jemmi AI.
Contains medical definitions, FAQ answers, and multilingual templates for 21 languages.
"""

from typing import Dict, Any

# Clinical Disclaimer appended to medical questions
CLINICAL_DISCLAIMER = "\n\n*Disclaimer: Jemmi provides educational support only and is not a substitute for a licensed neurologist.*"

MEDICAL_KB: Dict[str, str] = {
    "dementia": (
        "Dementia is not a single disease, but an umbrella term for a range of progressive neurological conditions "
        "affecting memory, thinking, behavior, and the ability to perform daily activities. It is caused by physical "
        "damage to brain cells, most commonly due to abnormal protein deposits or blood flow disruptions. Early screening "
        "and brain health tracking are critical for managing symptoms and slowing progression."
    ),
    "alzheimer's disease": (
        "Alzheimer's disease is the most common form of dementia, accounting for 60-80% of cases. It is characterized "
        "by the accumulation of amyloid-beta plaques and tau tangles in the brain, leading to cell damage and loss of "
        "connections between neurons. Key early symptoms include short-term memory loss, disorientation, and difficulty "
        "solving problems."
    ),
    "vascular dementia": (
        "Vascular dementia is the second most common form of dementia, caused by impaired blood flow to the brain, "
        "such as from a stroke or multiple microvascular blockages. Symptoms often progress in a stepwise fashion after "
        "vascular incidents. Managing cardiovascular risk factors (blood pressure, diabetes, cholesterol) is critical for prevention."
    ),
    "lewy body dementia": (
        "Lewy body dementia is associated with abnormal deposits of a protein called alpha-synuclein (Lewy bodies) in "
        "brain cells. It leads to progressive cognitive decline, fluctuating attention, visual hallucinations, and "
        "motor symptoms similar to Parkinson's disease, such as tremors and stiffness."
    ),
    "frontotemporal dementia": (
        "Frontotemporal dementia (FTD) is a group of disorders caused by progressive nerve cell loss in the brain's "
        "frontal or temporal lobes. Unlike Alzheimer's, FTD primarily manifests as significant changes in personality, "
        "social behavior, empathy, and language abilities, often occurring in younger individuals (ages 45-65)."
    ),
    "normal aging": (
        "In normal cognitive aging, individuals may experience occasional forgetfulness (e.g., misplacing keys, slower "
        "word recall), but these do not interfere with daily function. In contrast, dementia involves persistent, "
        "progressive cognitive deficits that disrupt independent living and daily problem-solving."
    ),
    "brain anatomy": (
        "The brain's structure dictates function: the hippocampus is responsible for memory consolidation; the frontal "
        "lobe controls reasoning, personality, and voluntary movement; the temporal lobe processes language and memory; "
        "and the cerebral cortex covers executive function. MRI scans evaluate cortical thickness and volume in these regions."
    ),
    "mri basics": (
        "Magnetic Resonance Imaging (MRI) uses magnetic fields and radio waves to generate detailed, non-invasive 3D images "
        "of brain tissue. It helps clinicians spot structural abnormalities, such as ventricular enlargement, localized gray "
        "matter atrophy (particularly in the hippocampus), and vascular damage (white matter hyperintensities)."
    ),
    "cognitive decline": (
        "Cognitive decline represents a gradual loss of cognitive abilities, including memory, reasoning, attention, and "
        "decision-making. It ranges from Mild Cognitive Impairment (MCI) to severe dementia. Cognitive tracking, neuroimaging, "
        "and lifestyle changes are important tools to evaluate and potentially slow down this decline."
    ),
    "memory loss": (
        "Memory loss can be benign (normal aging) or a symptom of an underlying condition like MCI, Alzheimer's, or stress. "
        "Recent memory impairment (e.g., repeating questions, forgetting recent conversations) is a hallmark of early-stage "
        "dementia, whereas long-term memories usually remain intact until later stages."
    ),
    "symptoms": (
        "Common symptoms of cognitive decline include repeating questions, losing track of dates, trouble completing familiar "
        "tasks, poor judgment, spatial disorientation, and personality or mood changes. If you observe these symptoms interfering "
        "with daily life, consulting a neurologist is recommended."
    ),
    "risk factors": (
        "Primary risk factors for dementia include age (the strongest risk), genetics (e.g., APOE-e4 gene), cardiovascular "
        "health (hypertension, high cholesterol, diabetes), smoking, obesity, hearing loss, social isolation, and physical "
        "inactivity. Addressing modifiable risk factors can lower overall dementia risk."
    ),
    "stages": (
        "Dementia generally progresses through three stages: Early (Mild) - subtle memory issues, difficulty planning, but "
        "remains independent; Middle (Moderate) - increased confusion, needing help with daily tasks, changes in behavior; "
        "and Late (Severe) - complete dependence on caregivers, loss of verbal communication and motor control."
    ),
    "diagnosis": (
        "Dementia diagnosis involves a comprehensive clinical evaluation, including medical history, cognitive assessments "
        "(e.g., MMSE, MoCA), blood tests to rule out metabolic causes, and neuroimaging (brain MRI or CT) to analyze structural "
        "atrophy and rule out strokes or tumors."
    ),
    "treatment": (
        "While most progressive dementias cannot be cured, treatments can manage symptoms. Medications include cholinesterase "
        "inhibitors (e.g., donepezil) for memory and memantine for moderate-to-severe symptoms. Non-pharmacological therapies, "
        "such as cognitive stimulation and lifestyle management, are highly recommended."
    ),
    "lifestyle": (
        "Maintaining a brain-healthy lifestyle can slow down cognitive decline. Key pillars include regular cardiovascular "
        "exercise, eating a Mediterranean-style diet, engaging in continuous cognitive learning, managing vascular risk factors, "
        "getting quality sleep, and maintaining active social connections."
    ),
    "preprevention": (
        "Dementia prevention focuses on lifestyle changes: managing hypertension, staying physically active, treating hearing loss, "
        "preventing head injuries, limiting alcohol consumption, stopping smoking, and maintaining active mental and social engagement "
        "throughout life."
    ),
    "prevention": (
        "Dementia prevention focuses on lifestyle changes: managing hypertension, staying physically active, treating hearing loss, "
        "preventing head injuries, limiting alcohol consumption, stopping smoking, and maintaining active mental and social engagement "
        "throughout life."
    ),
    "nutrition": (
        "A brain-healthy diet, such as the Mediterranean or MIND diet, focuses on green leafy vegetables, berries, nuts, whole grains, "
        "olive oil, poultry, and fish high in omega-3 fatty acids (like salmon). Limit red meat, saturated fats, sugar, and processed foods "
        "to support brain vascular health."
    ),
    "exercise": (
        "Physical exercise increases blood flow to the brain, triggers neurotrophic factors (like BDNF), and promotes neural plasticity. "
        "Aim for at least 150 minutes of moderate-intensity aerobic exercise (such as brisk walking or swimming) per week, "
        "complemented by strength and balance routines."
    ),
    "sleep": (
        "Quality sleep is vital for brain health because the glymphatic system clears metabolic wastes, including amyloid-beta proteins, "
        "from the brain during deep sleep. Chronic sleep deprivation and untreated sleep apnea are linked to a higher risk of cognitive decline."
    ),
    "mental health": (
        "Depression, chronic stress, and anxiety can mimic or accelerate cognitive decline. High cortisol levels from prolonged stress "
        "can damage the hippocampus, which handles memory. Seeking mental health support and practicing mindfulness are key for brain wellness."
    ),
    "caregiver support": (
        "Caring for an individual with dementia is physically and emotionally demanding. Caregivers should utilize support networks, "
        "seek respite care, learn behavioral management strategies, and prioritize their own mental and physical health to prevent burnout."
    ),
    "clinical guidelines": (
        "Clinical guidelines recommend regular cognitive screenings for individuals over 65 presenting with memory complaints. "
        "Standardized workups include structural brain MRI to evaluate regional volume loss and neuropsychological evaluations "
        "to track progress and inform individualized care plans."
    ),
    "medical disclaimer": (
        "All information provided is for educational purposes. Brain health predictions or screening metrics are not formal "
        "medical diagnoses. A professional neurological workup and physician consultation are required to diagnose cognitive disorders."
    )
}

FAQ_KB: Dict[str, str] = {
    "what is dementia?": (
        "Dementia is an umbrella term for a range of progressive conditions characterized by cognitive decline, memory impairment, "
        "and behavioral changes that disrupt daily independence. It is caused by progressive damage to brain cells."
    ),
    "what is alzheimer's disease?": (
        "Alzheimer's disease is the most common form of dementia (60-80% of cases). It involves abnormal deposits of amyloid-beta plaques "
        "and tau tangles, causing progressive memory loss and cognitive decline."
    ),
    "can dementia be cured?": (
        "Most progressive dementias, including Alzheimer's, currently have no cure. However, certain symptomatic treatments, "
        "lifestyle interventions, and cognitive therapies can help manage symptoms, improve quality of life, and slow decline."
    ),
    "is dementia hereditary?": (
        "Most cases of dementia are not directly inherited, but having a family history increases risk. Specific genetic variants, "
        "like the APOE-e4 allele, increase susceptibility, while rare mutations cause direct familial early-onset Alzheimer's."
    ),
    "what causes memory loss?": (
        "Memory loss can be caused by normal aging, sleep deprivation, chronic stress, depression, nutritional deficiencies (like Vitamin B12), "
        "thyroid disorders, side effects of medications, or neurodegenerative diseases such as dementia."
    ),
    "how accurate is mri?": (
        "Brain MRI is highly accurate at revealing structural changes, atrophy in areas like the hippocampus, and vascular lesions. "
        "However, structural imaging is used to support a diagnosis; it must be combined with clinical and cognitive testing."
    ),
    "what is mild demented?": (
        "Mild Dementia (often correlating with Mild Cognitive Impairment or early-stage dementia) means an individual has noticeable "
        "cognitive changes, such as mild memory loss or planning issues, but remains mostly independent in daily activities."
    ),
    "what does confidence score mean?": (
        "The prediction confidence score represents the neuroimaging machine learning model's statistical certainty in its classification "
        "(e.g., Cognitive Normal or Mild Dementia) based on structural features analyzed from your uploaded MRI scan."
    ),
    "what is a neurologist?": (
        "A neurologist is a medical doctor who specializes in diagnosing, treating, and managing disorders of the brain, spinal cord, "
        "nerves, and muscles, including cognitive conditions, Alzheimer's disease, and stroke."
    ),
    "how does neuroscan ai work?": (
        "NeuroScan AI uses deep learning algorithms to analyze brain MRI scans. It segment brain tissues, estimates regional gray matter "
        "volume, calculates a dementia risk score, and maps probability distributions to assist clinicians in cognitive screening."
    )
}

# Multilingual default static replies for 21 languages
# Triggers: Greeting, Goodbye, Thank You, Help, Disclaimer, Offline Status
MULTILINGUAL_DEFAULTS: Dict[str, Dict[str, str]] = {
    "English": {
        "greeting": "Hello! I am Jemmi AI, your professional brain health assistant. How can I help you today?",
        "goodbye": "Goodbye! Take care of your brain health. Feel free to reach out if you have more questions.",
        "thanks": "You are very welcome! It is my pleasure to support your cognitive health journey.",
        "help": "I can answer queries about dementia, explain brain anatomy, show your latest MRI predictions, or fetch patient files.",
        "disclaimer": "*Disclaimer: Jemmi provides educational support only and is not a substitute for a licensed neurologist.*",
        "offline": "I'm currently using my offline medical knowledge to assist you. Some advanced AI features may be temporarily unavailable."
    },
    "Telugu": {
        "greeting": "నమస్కారం! నేను జెమ్మీ ఐ, మీ మెదడు ఆరోగ్య సహాయకురాలిని. ఈ రోజు మీకు ఎలా సహాయపడగలను?",
        "goodbye": "సెలవు! మీ మెదడు ఆరోగ్యాన్ని జాగ్రత్తగా చూసుకోండి. ఏవైనా ప్రశ్నలు ఉంటే మళ్లీ సంప్రదించండి.",
        "thanks": "మీకు చాలా ధన్యవాదాలు! మీ సంజ్ఞానాత్మక ఆరోగ్య ప్రయాణంలో సహాయం చేయడం నా సంతోషం.",
        "help": "నేను డిమెన్షియా గురించిన ప్రశ్నలకు సమాధానమివ్వగలను, మీ తాజా MRI నివేదికలను చూపించగలను లేదా రోగి వివరాలను పొందగలను.",
        "disclaimer": "*నిరాకరణ: జెమ్మీ విద్యాపరమైన సమాచారాన్ని మాత్రమే అందిస్తుంది మరియు లైసెన్స్ పొందిన న్యూరాలజిస్టుకు ప్రత్యామ్నాయం కాదు.*",
        "offline": "నేను ప్రస్తుతం నా ఆఫ్‌లైన్ వైద్య పరిజ్ఞానాన్ని ఉపయోగించి మీకు సహాయం చేస్తున్నాను. కొన్ని అధునాతన AI ఫీచర్లు అందుబాటులో ఉండకపోవచ్చు."
    },
    "Hindi": {
        "greeting": "नमस्ते! मैं जेमी एआई हूँ, आपकी मस्तिष्क स्वास्थ्य सहायक। आज मैं आपकी क्या मदद कर सकती हूँ?",
        "goodbye": "अलविदा! अपने मस्तिष्क स्वास्थ्य का ध्यान रखें। कोई और प्रश्न होने पर अवश्य पूछें।",
        "thanks": "आपका बहुत-बहुत धन्यवाद! आपके संज्ञानात्मक स्वास्थ्य का समर्थन करना मेरा सौभाग्य है.",
        "help": "मैं डिमेंशिया के बारे में उत्तर दे सकती हूँ, आपके एमआरआई परिणाम दिखा सकती हूँ, या मरीज की फ़ाइलें देख सकती हूँ।",
        "disclaimer": "*अस्वीकरण: जेमी केवल शैक्षिक सहायता प्रदान करती है और यह किसी प्रमाणित न्यूरोलॉजिस्ट का विकल्प नहीं है।*",
        "offline": "मैं वर्तमान में आपकी सहायता के लिए अपने ऑफ़लाइन चिकित्सा ज्ञान का उपयोग कर रही हूँ। कुछ उन्नत एआई सुविधाएं अस्थायी रूप से अनुपलब्ध हो सकती हैं।"
    },
    "Tamil": {
        "greeting": "வணக்கம்! நான் ஜெம்மி AI, உங்கள் மூளை சுகாதார உதவியாளர். இன்று நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?",
        "goodbye": "சென்று வருகிறேன்! உங்கள் மூளை ஆரோக்கியத்தை கவனித்துக் கொள்ளுங்கள். மேலும் கேள்விகளுக்கு எப்போது வேண்டுமானாலும் தொடர்பு கொள்ளவும்.",
        "thanks": "மிக்க நன்றி! உங்கள் அறிவாற்றல் ஆரோக்கிய பயணத்திற்கு உதவுவதில் மகிழ்ச்சி அடைகிறேன்.",
        "help": "நான் டிமென்ஷியா பற்றிய கேள்விகளுக்கு பதிலளிக்க முடியும், உங்கள் சமீபத்திய MRI முடிவுகளை காட்ட முடியும், அல்லது நோயாளி கோப்புகளை பெற முடியும்.",
        "disclaimer": "*பொறுப்புத் துறப்பு: ஜெம்மி கல்வித் தகவல்களை மட்டுமே வழங்குகிறது, இது ஒரு நரம்பியல் நிபுணருக்கு மாற்றாகாது.*",
        "offline": "நான் தற்போது எனது ஆஃப்லைன் மருத்துவ அறிவைப் பயன்படுத்தி உங்களுக்கு உதவுகிறேன். சில மேம்பட்ட AI அம்சங்கள் தற்காலிகமாக கிடைக்காமல் போகலாம்."
    },
    "Kannada": {
        "greeting": "ನಮಸ್ಕಾರ! ನಾನು ಜೆಮ್ಮಿ ಎಐ, ನಿಮ್ಮ ಮಿದುಳಿನ ಆರೋಗ್ಯ ಸಹಾಯಕರು. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?",
        "goodbye": "ಹೋಗಿ ಬನ್ನಿ! ನಿಮ್ಮ ಮಿದುಳಿನ ಆರೋಗ್ಯವನ್ನು ಕಾಪಾಡಿಕೊಳ್ಳಿ. ಯಾವುದೇ ಪ್ರಶ್ನೆಗಳಿದ್ದರೆ ಮರಳಿ ಕೇಳಿ.",
        "thanks": "ನಿಮಗೆ ಹೃತ್ಪೂರ್ವಕ ಧನ್ಯವಾದಗಳು! ನಿಮ್ಮ ಜ್ಞಾನಗ್ರಹಣ ಆರೋಗ್ಯದ ಆರೈಕೆಯಲ್ಲಿ ಸಹಾಯ ಮಾಡುವುದು ನನ್ನ ಸೌಭಾಗ್ಯ.",
        "help": "ನಾನು ಡಿಮೆನ್ಶಿಯಾ ಕುರಿತು ಉತ್ತರಿಸಬಲ್ಲೆ, ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಎಂಆರ್ಐ ವರದಿಗಳನ್ನು ತೋರಿಸಬಲ್ಲೆ, ಅಥವಾ ರೋಗಿಯ ವಿವರಗಳನ್ನು ತರಬಲ್ಲೆ.",
        "disclaimer": "*ಹಕ್ಕುತ್ಯಾಗ: ಜೆಮ್ಮಿ ಶೈಕ್ಷಣಿಕ ಮಾಹಿತಿಯನ್ನು ಮಾತ್ರ ಒದಗಿಸುತ್ತದೆ ಮತ್ತು ಇದು ನರರೋಗ ತಜ್ಞರ ಚಿಕಿತ್ಸೆಗೆ ಪರ್ಯಾಯವಲ್ಲ.*",
        "offline": "ನಾನು ಪ್ರಸ್ತುತ ನನ್ನ ಆಫ್‌ಲೈನ್ ವೈದ್ಯಕೀಯ ಜ್ಞಾನವನ್ನು ಬಳಸಿಕೊಂಡು ನಿಮಗೆ ಸಹಾಯ ಮಾಡುತ್ತಿದ್ದೇನೆ. ಕೆಲವು ಸುಧಾರಿತ AI ವೈಶಿಷ್ಟ್ಯಗಳು ತಾತ್ಕಾಲಿಕವಾಗಿ ಲಭ್ಯವಿಲ್ಲದಿರಬಹುದು."
    },
    "Malayalam": {
        "greeting": "ഹലോ! ഞാൻ ജെമ്മി AI, നിങ്ങളുടെ മസ്തിഷ്ക ആരോഗ്യ സഹായി. ഇന്ന് ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം?",
        "goodbye": "പോയി വരാം! നിങ്ങളുടെ മസ്തിഷ്ക ആരോഗ്യം ശ്രദ്ധിക്കുക. സംശയങ്ങൾക്ക് വീണ്ടും ബന്ധപ്പെടുക.",
        "thanks": "വളരെയധികം നന്ദി! നിങ്ങളുടെ മസ്തിഷ്ക ആരോഗ്യ യാത്രയ്ക്ക് പിന്തുണ നൽകാൻ കഴിഞ്ഞതിൽ സന്തോഷമുണ്ട്.",
        "help": "ഡിമെൻഷ്യയെക്കുറിച്ചുള്ള സംശയങ്ങൾ തീർക്കാനും, നിങ്ങളുടെ എംആർഐ ഫലങ്ങൾ കാണിക്കാനും, രോഗിയുടെ വിവരങ്ങൾ പരിശോധിക്കാനും എനിക്ക് കഴിയും.",
        "disclaimer": "*ബാധ്യതാനിരസനം: ജെമ്മി വിദ്യാഭ്യാസപരമായ പിന്തുണ മാത്രമാണ് നൽകുന്നത്, ഇത് ഒരു ന്യൂറോളജിസ്റ്റിന് പകരമല്ല.*",
        "offline": "ഞാൻ ഇപ്പോൾ എൻ്റെ ഓഫ്‌ലൈൻ മെഡിക്കൽ അറിവ് ഉപയോഗിച്ചാണ് നിങ്ങളെ സഹായിക്കുന്നത്. ചില നൂതന AI ഫീച്ചറുകൾ താത്കാലികമായി ലഭ്യമായേക്കില്ല."
    },
    "Marathi": {
        "greeting": "नमस्कार! मी जेम्मी एआय आहे, तुमची मेंदू आरोग्य सहाय्यक. आज मी तुम्हाला कशी मदत करू शकते?",
        "goodbye": "निरोप घ्या! आपल्या मेंदूच्या आरोग्याची काळजी घ्या. काही अडचण असल्यास नक्की विचारा.",
        "thanks": "आपले खूप खूप धन्यवाद! आपल्या मेंदूच्या आरोग्याची काळजी घेण्यात मदत करणे हा माझा आनंद आहे.",
        "help": "मी डिमेंशियाबद्दल माहिती देऊ शकते, तुमचे नवीन एमआरआय अहवाल दाखवू शकते किंवा रुग्णाची माहिती शोधू शकते.",
        "disclaimer": "*अस्वीकरण: जेम्मी केवळ शैक्षणिक माहिती पुरवते आणि प्रमाणित न्यूरोलॉजिस्टचा पर्याय नाही.*",
        "offline": "मी सध्या माझी ऑफलाइन वैद्यकीय माहिती वापरून तुम्हाला मदत करत आहे. काही प्रगत AI वैशिष्ट्ये तात्पुरती अनुपलब्ध असू शकतात."
    },
    "Gujarati": {
        "greeting": "નમસ્તે! હું જેમ્મી એઆઈ છું, તમારી મગજ સ્વાસ્થ્ય સહાયક. આજે હું તમને કેવી રીતે મદદ કરી શકું?",
        "goodbye": "આવજો! તમારા મગજના સ્વાસ્થ્યનું ધ્યાન રાખો. કોઈ પણ પ્રશ્ન માટે ફરી સંપર્ક કરો.",
        "thanks": "આપનો ખુબ ખુબ આભાર! તમારા મગજના સ્વાસ્થ્યની સંભાળમાં મદદ કરવી એ મારો આનંદ છે.",
        "help": "હું ડિમેન્શિયા વિશે માહિતી આપી શકું છું, તમારા એમઆરઆઈ રિપોર્ટ બતાવી શકું છું અથવા દર્દીની વિગતો મેળવી શકું છું.",
        "disclaimer": "*અસ્વીકરણ: જેમ્મી ફક્ત શૈક્ષણિક માહિતી પૂરી પાડે છે અને તે ન્યુરોલોજીસ્ટનો વિકલ્પ નથી.*",
        "offline": "હું હાલમાં મારી ઓફલાઇન તબીબી માહિતીનો ઉપયોગ કરીને આપને સહાય કરી રહી છું. કેટલીક અદ્યતન એઆઈ સુવિધાઓ અસ્થાયી રૂપે અનુપલબ્ધ હોઈ શકે છે."
    },
    "Punjabi": {
        "greeting": "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਜੈਮੀ ਏਆਈ ਹਾਂ, ਤੁਹਾਡੀ ਦਿਮਾਗੀ ਸਿਹਤ ਸਹਾਇਕ। ਅੱਜ ਮੈਂ ਤੁਹਾਡੀ ਕੀ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?",
        "goodbye": "ਅਲਵਿਦਾ! ਆਪਣੀ ਦਿਮਾਗੀ ਸਿਹਤ ਦਾ ਖਿਆਲ ਰੱਖੋ। ਕੋਈ ਹੋਰ ਸਵਾਲ ਹੋਣ 'ਤੇ ਜ਼ਰੂਰ ਪੁੱਛੋ।",
        "thanks": "ਤੁਹਾਡਾ ਬਹੁਤ-ਬਹੁਤ ਧੰਨਵਾਦ! ਤੁਹਾਡੀ ਸਿਹਤ ਯਾਤਰਾ ਵਿੱਚ ਮਦਦ ਕਰਨਾ ਮੇਰਾ ਸੁਭਾਗ ਹੈ।",
        "help": "ਮੈਂ ਡਿਮੈਂਸ਼ੀਆ ਬਾਰੇ ਦੱਸ ਸਕਦਾ ਹਾਂ, ਤੁਹਾਡੀ ਐਮਆਰਆਈ ਰਿਪੋਰਟ ਦਿਖਾ ਸਕਦਾ ਹਾਂ, ਜਾਂ ਮਰੀਜ਼ ਦੇ ਵੇਰਵੇ ਲੱਭ ਸਕਦਾ ਹਾਂ।",
        "disclaimer": "*ਬੇਦਾਅਵਾ: ਜੈਮੀ ਸਿਰਫ ਵਿਦਿਅਕ ਸਹਾਇਤਾ ਪ੍ਰਦਾਨ ਕਰਦੀ ਹੈ ਅਤੇ ਲਾਇਸੈਂਸਸ਼ੁਦਾ ਨਿਊਰੋਲੋਜਿਸਟ ਦਾ ਬਦਲ ਨਹੀਂ ਹੈ।*",
        "offline": "ਮੈਂ ਇਸ ਵੇਲੇ ਤੁਹਾਡੀ ਮਦਦ ਲਈ ਆਪਣੀ ਆਫਲਾਈਨ ਡਾਕਟਰੀ ਜਾਣਕਾਰੀ ਦੀ ਵਰਤੋਂ ਕਰ ਰਿਹਾ ਹਾਂ। ਕੁਝ ਉੱਨਤ AI ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ ਅਸਥਾਈ ਤੌਰ 'ਤੇ ਉਪਲਬਧ ਨਹੀਂ ਹੋ ਸਕਦੀਆਂ।"
    },
    "Bengali": {
        "greeting": "নমস্কার! আমি জেম্মি এআই, আপনার মস্তিষ্কের স্বাস্থ্য সহায়ক। আজ আপনাকে কীভাবে সাহায্য করতে পারি?",
        "goodbye": "বিদায়! আপনার মস্তিষ্কের স্বাস্থ্যের যত্ন নিন। কোনো প্রশ্ন থাকলে আবার যোগাযোগ করুন।",
        "thanks": "আপনাকে অনেক ধন্যবাদ! আপনার মস্তিষ্কের স্বাস্থ্যের যত্ন নেওয়া আমার জন্য আনন্দের বিষয়।",
        "help": "আমি ডিমেনশিয়া সম্পর্কিত প্রশ্নের উত্তর দিতে পারি, আপনার এমআরআই রিপোর্ট দেখাতে পারি বা রোগীর বিবরণ খুঁজতে পারি।",
        "disclaimer": "*দাবিত্যাগ: জেম্মি কেবল শিক্ষামূলক সহায়তা প্রদান করে এবং এটি কোনো নিবন্ধিত নিউরোলজিস্টের বিকল্প নয়।*",
        "offline": "আমি বর্তমানে আমার অফলাইন চিকিৎসা জ্ঞান ব্যবহার করে আপনাকে সাহায্য করছি। কিছু উন্নত AI ফিচার সাময়িকভাবে বন্ধ থাকতে পারে।"
    },
    "Urdu": {
        "greeting": "السلام علیکم! میں جیمی اے آئی ہوں، آپ کی دماغی صحت کی معاون۔ آج میں آپ کی کیا مدد کر سکتی ہوں؟",
        "goodbye": "خدا حافظ! اپنے دماغی صحت کا خیال رکھیں۔ کوئی اور سوال ہو تو ضرور پوچھیں۔",
        "thanks": "آپ کا بہت شکریہ! آپ کی دماغی صحت کے سفر میں معاونت کرنا میرے لیے باعثِ مسرت ہے۔",
        "help": "میں ڈیمنشیا کے بارے میں معلومات دے سکتی ہوں، آپ کے ایم آر آئی کے نتائج دکھا سکتی ہوں، یا مریض کی تفصیلات حاصل کر سکتی ہوں۔",
        "disclaimer": "*دستبرداری: جیمی صرف تعلیمی مدد فراہم کرتی ہے اور یہ لائسنس یافتہ نیورولوجسٹ کا متبادل نہیں ہے۔*",
        "offline": "میں اس وقت آپ کی مدد کے لیے اپنی آف لائن طبی معلومات کا استعمال کر رہی ہوں۔ کچھ جدید ترین خصوصیات عارضی طور پر بند ہو سکتی ہیں۔"
    },
    "Spanish": {
        "greeting": "¡Hola! Soy Jemmi AI, su asistente profesional de salud cerebral. ¿Cómo puedo ayudarle hoy?",
        "goodbye": "¡Adiós! Cuide su salud cerebral. No dude en contactarme si tiene más preguntas.",
        "thanks": "¡De nada! Es un placer apoyar el cuidado de su salud cognitiva.",
        "help": "Puedo responder preguntas sobre demencia, explicar anatomía cerebral, mostrar sus predicciones de resonancia magnética o buscar archivos de pacientes.",
        "disclaimer": "*Descargo de responsabilidad: Jemmi proporciona apoyo educativo únicamente y no sustituye a un neurólogo licenciado.*",
        "offline": "Actualmente estoy usando mi conocimiento médico local sin conexión. Algunas funciones avanzadas de IA pueden no estar disponibles."
    },
    "French": {
        "greeting": "Bonjour ! Je suis Jemmi AI, votre assistante professionnelle en santé cérébrale. Comment puis-je vous aider aujourd'hui ?",
        "goodbye": "Au revoir ! Prenez soin de votre santé cérébrale. N'hésitez pas à me recontacter.",
        "thanks": "Je vous en prie ! C'est un plaisir de soutenir votre santé cognitive.",
        "help": "Je peux répondre à vos questions sur la démence, expliquer l'anatomie cérébrale, afficher vos résultats d'IRM ou consulter les dossiers patients.",
        "disclaimer": "*Avertissement : Jemmi fournit un soutien éducatif uniquement et ne remplace pas un neurologue agréé.*",
        "offline": "J'utilise actuellement mes connaissances médicales hors ligne. Certaines fonctionnalités d'IA peuvent être indisponibles."
    },
    "German": {
        "greeting": "Hallo! Ich bin Jemmi AI, Ihre Assistentin für Gehirngesundheit. Wie kann ich Ihnen heute helfen?",
        "goodbye": "Auf Wiedersehen! Achten Sie auf Ihre Gehirngesundheit. Melden Sie sich gerne bei weiteren Fragen.",
        "thanks": "Gern geschehen! Es ist mir eine Freude, Ihre kognitive Gesundheit zu unterstützen.",
        "help": "Ich kann Fragen zu Demenz beantworten, die Gehirnanatomie erklären, Ihre MRT-Ergebnisse anzeigen oder Patientendaten abrufen.",
        "disclaimer": "*Haftungsausschluss: Jemmi dient nur zu Informationszwecken und ersetzt keinen qualifizierten Neurologen.*",
        "offline": "Ich nutze derzeit mein lokales medizinisches Wissen. Einige erweiterte KI-Funktionen sind eventuell nicht verfügbar."
    },
    "Arabic": {
        "greeting": "مرحباً! أنا جيمي، مساعدتك الذكية لصحة الدماغ. كيف يمكنني مساعدتك اليوم؟",
        "goodbye": "وداعاً! اعتنِ بصحة دماغك. لا تتردد في الاتصال بي إذا كانت لديك المزيد من الأسئئة.",
        "thanks": "على الرحب والسعة! يسعدني جداً تقديم الدعم لرحلتك الصحية المعرفية.",
        "help": "يمكنني الإجابة على استفسارات الخرف، شرح تشريح الدماغ، عرض توقعات الرنين المغناطيسي، أو جلب ملفات المريض.",
        "disclaimer": "*إخلاء مسؤولية: تقدم جيمي دعماً تعليمياً فقط وهي ليست بديلاً عن أخصائي أعصاب مرخص.*",
        "offline": "أنا أستخدم حاليًا معرفتي الطبية المحلية لمساعدتك. قد تكون بعض ميزات الذكاء الاصطناعي المتقدمة غير متاحة مؤقتًا."
    },
    "Japanese": {
        "greeting": "こんにちは！私は脳の健康をサポートするAIアシスタントのジェミーです。本日はどのような用件でしょうか？",
        "goodbye": "さようなら！脳の健康にお気をつけて。ご質問があればいつでもどうぞ。",
        "thanks": "どういたしまして！あなたの認知機能の健康維持をサポートできて嬉しく思います。",
        "help": "認知症に関する質問への回答、脳の解剖図の説明、最新のMRI解析結果の表示、または患者情報の照会が可能です。",
        "disclaimer": "*免責事項：ジェミーは情報提供のみを目的としており、専門の脳神経内科医の診断に代わるものではありません。*",
        "offline": "現在オフラインの医療知識ベースを使用してアシストしています。一部の高度なAI機能は一時的にご利用いただけません。"
    },
    "Chinese": {
        "greeting": "您好！我是杰米（Jemmi AI），您的专业脑部健康助手。今天有什么我可以帮您的吗？",
        "goodbye": "再见！请保重脑部健康。如有任何问题，欢迎随时联系我。",
        "thanks": "不客气！非常高兴能为您的认知健康护航。",
        "help": "我可以回答关于认知障碍症的问题、解释大脑结构、显示最新的脑部MRI预测结果或查询患者档案。",
        "disclaimer": "*免责声明：杰米仅提供科普辅助信息，不能替代注册脑神经科医生的专业诊断。*",
        "offline": "我目前正在使用我的离线医疗知识为您服务。某些高级AI功能可能暂时无法使用。"
    },
    "Korean": {
        "greeting": "안녕하세요! 저는 뇌 건강을 돕는 전문 AI 비서 제미(Jemmi AI)입니다. 오늘 어떤 도움이 필요하신가요?",
        "goodbye": "안녕히 가세요! 뇌 건강 관리에 유의하시고, 궁금한 점이 있으면 언제든 문의해 주세요.",
        "thanks": "천만에요! 귀하의 인지 건강 여정을 지원하게 되어 기쁩니다.",
        "help": "치매에 대한 질문 답변, 뇌 구조 설명, 최신 MRI 판독 결과 조회, 환자 기록 검색 등이 가능합니다.",
        "disclaimer": "*면책 조항: 제미는 교육적 지원만을 제공하며, 전문 신경과 전문의의 진단을 대체할 수 없습니다.*",
        "offline": "현재 오프라인 의료 지식베이스를 기반으로 지원 중입니다. 일부 고급 AI 기능은 일시적으로 제한될 수 있습니다."
    },
    "Portuguese": {
        "greeting": "Olá! Eu sou a Jemmi AI, sua assistente profissional de saúde cerebral. Como posso ajudar você hoje?",
        "goodbye": "Adeus! Cuide da sua saúde cerebral. Fique à vontade para entrar em contato se tiver dúvidas.",
        "thanks": "De nada! É um prazer apoiar a jornada de sua saúde cognitiva.",
        "help": "Posso responder a dúvidas sobre demência, explicar a anatomia do cérebro, exibir os resultados da sua ressonância magnética ou acessar dados do paciente.",
        "disclaimer": "*Aviso: A Jemmi fornece apenas suporte educacional e não substitui um neurologista licenciado.*",
        "offline": "No momento, estou usando minhas informações médicas locais off-line. Algumas funções avançadas de IA podem estar indisponíveis."
    },
    "Italian": {
        "greeting": "Ciao! Sono Jemmi AI, la tua assistente professionale per la salute cerebrale. Come posso aiutarti oggi?",
        "goodbye": "Arrivederci! Prendi cura della tua salute cerebrale. Contattami pure per altre domande.",
        "thanks": "Prego! È un piacere sostenere il tuo percorso di salute cognitiva.",
        "help": "Posso rispondere a domande sulla demenza, spiegare l'anatomia del cervello, mostrare le tue risonanze magnetiche o trovare le schede dei pazienti.",
        "disclaimer": "*Disclaimer: Jemmi fornisce solo supporto educativo e non sostituisce un neurologo qualificato.*",
        "offline": "Attualmente sto utilizzando la mia conoscenza medica locale offline. Alcune funzioni IA avanzate potrebbero essere temporaneamente non disponibili."
    },
    "Russian": {
        "greeting": "Здравствуйте! Я Джемми AI, ваш помощник по здоровью мозга. Чем я могу помочь вам сегодня?",
        "goodbye": "До свидания! Берегите здоровье своего мозга. Обращайтесь, если возникнут вопросы.",
        "thanks": "Пожалуйста! Рада помочь вам на пути сохранения когнитивного здоровья.",
        "help": "Я могу ответить на вопросы о деменции, объяснить анатомию мозга, показать результаты МРТ или найти данные пациента.",
        "disclaimer": "*Отказ от ответственности: Джемми предоставляет только справочную информацию и не заменяет лицензированного невролога.*",
        "offline": "В настоящее время я использую оффлайн-базу медицинских знаний. Некоторые расширенные функции ИИ могут быть недоступны."
    }
}
