# Accessibility Evaluation Report

## 1. Evaluation Scope

- **Date**: 2025-04-22
- **Tool**: [Pa11y](https://pa11y.org)
- **Pages evaluated**:
  - Homepage: https://borgr.be
  - Contact: https://borgr.be/contact
  - Huurders: https://borgr.be/ben-je-een-huurder
  - Application: https://app.borgr.be

## 2. Methodology

This report was generated using **automated evaluation** only. Manual testing is recommended for full conformance verification.
- **Standard**: WCAG 2.1
- **Conformance Level**: AA
- **Tool**: Pa11y (headless Chrome)

## 3. Summary Table of WCAG Success Criteria

### 1. Perceivable

#### 1.1 Text Alternatives

| SC | Title | Description | Level | Status | Pages |
|----|--------------|--------------------------|-------|--------|--------|
| 1.1.1 | Non-text Content | All non-text content that is presented to the user has a text alternative that serves the equivalent purpose, except for the situations listed below. | A | ✅ Met | - |
#### 1.2 Time-based Media

| SC | Title | Description | Level | Status | Pages |
|----|--------------|--------------------------|-------|--------|--------|
| 1.2.1 | Audio-only and Video-only (Prerecorded) | For prerecorded audio-only and prerecorded video-only media, the following are true, except when the audio or video is a media alternative for text and is clearly labeled as such: | A | ✅ Met | - |
| 1.2.2 | Captions (Prerecorded) | Captions are provided for all prerecorded audio content in synchronized media, except when the media is a media alternative for text and is clearly labeled as such. | A | ✅ Met | - |
| 1.2.3 | Audio Description or Media Alternative (Prerecorded) | An alternative for time-based media or audio description of the prerecorded video content is provided for synchronized media, except when the media is a media alternative for text and is clearly labeled as such. | A | ✅ Met | - |
| 1.2.4 | Captions (Live) | Captions are provided for all live audio content in synchronized media. | AA | ✅ Met | - |
| 1.2.5 | Audio Description (Prerecorded) | Audio description is provided for all prerecorded video content in synchronized media. | AA | ✅ Met | - |
#### 1.3 Adaptable

| SC | Title | Description | Level | Status | Pages |
|----|--------------|--------------------------|-------|--------|--------|
| 1.3.1 | Info and Relationships | Information, structure, and relationships conveyed through presentation can be programmatically determined or are available in text. | A | ✅ Met | - |
| 1.3.2 | Meaningful Sequence | When the sequence in which content is presented affects its meaning, a correct reading sequence can be programmatically determined. | A | ✅ Met | - |
| 1.3.3 | Sensory Characteristics | Instructions provided for understanding and operating content do not rely solely on sensory characteristics of components such as shape, color, size, visual location, orientation, or sound. | A | ✅ Met | - |
#### 1.4 Distinguishable

| SC | Title | Description | Level | Status | Pages |
|----|--------------|--------------------------|-------|--------|--------|
| 1.4.1 | Use of Color | Color is not used as the only visual means of conveying information, indicating an action, prompting a response, or distinguishing a visual element. | A | ✅ Met | - |
| 1.4.3 | Contrast (Minimum) | The visual presentation of text and images of text has a contrast ratio of at least 4.5:1, except for the following: | AA | ✅ Met | - |
| 1.4.4 | Resize Text | Except for captions and images of text, text can be resized without assistive technology up to 200 percent without loss of content or functionality. | AA | ✅ Met | - |
| 1.4.5 | Images of Text | If the technologies being used can achieve the visual presentation, text is used to convey information rather than images of text except for the following: | AA | ✅ Met | - |
| 1.4.10 | Reflow | Content can be presented without loss of information or functionality, and without requiring scrolling in two dimensions for: | AA | ✅ Met | - |
| 1.4.11 | Non-text Contrast | The visual presentation of the following have a contrast ratio of at least 3:1 against adjacent color(s): | AA | ✅ Met | - |
| 1.4.12 | Text Spacing | In content implemented using markup languages that support the following text style properties, no loss of content or functionality occurs by setting all of the following and by changing no other style property: | AA | ✅ Met | - |
| 1.4.13 | Content on Hover or Focus | Where receiving and then removing pointer hover or keyboard focus triggers additional content to become visible and then hidden, the following are true: | AA | ✅ Met | - |
### 2. Operable

#### 2.1 Keyboard Accessible

| SC | Title | Description | Level | Status | Pages |
|----|--------------|--------------------------|-------|--------|--------|
| 2.1.1 | Keyboard | All functionality of the content is operable through a keyboard interface without requiring specific timings for individual keystrokes, except where the underlying function requires input that depends on the path of the user's movement and not just the endpoints. | A | ✅ Met | - |
| 2.1.2 | No Keyboard Trap | If keyboard focus can be moved to a component of the page using a keyboard interface, then focus can be moved away from that component using only a keyboard interface, and, if it requires more than unmodified arrow or tab keys or other standard exit methods, the user is advised of the method for moving focus away. | A | ✅ Met | - |
#### 2.2 Enough Time

| SC | Title | Description | Level | Status | Pages |
|----|--------------|--------------------------|-------|--------|--------|
| 2.2.1 | Timing Adjustable | For each time limit that is set by the content, at least one of the following is true: | A | ✅ Met | - |
| 2.2.2 | Pause, Stop, Hide | For moving, blinking, scrolling, or auto-updating information, all of the following are true: | A | ✅ Met | - |
#### 2.3 Seizures and Physical Reactions

| SC | Title | Description | Level | Status | Pages |
|----|--------------|--------------------------|-------|--------|--------|
| 2.3.1 | Three Flashes or Below Threshold | Web pages do not contain anything that flashes more than three times in any one second period, or the flash is below the general flash and red flash thresholds. | A | ✅ Met | - |
#### 2.4 Navigable

| SC | Title | Description | Level | Status | Pages |
|----|--------------|--------------------------|-------|--------|--------|
| 2.4.1 | Bypass Blocks | A mechanism is available to bypass blocks of content that are repeated on multiple Web pages. | A | ❌ Not Met | Homepage, Contact, Huurders, Application |
| 2.4.2 | Page Titled | Web pages have titles that describe topic or purpose. | A | ✅ Met | - |
| 2.4.3 | Focus Order | If a Web page can be navigated sequentially and the navigation sequences affect meaning or operation, focusable components receive focus in an order that preserves meaning and operability. | A | ✅ Met | - |
| 2.4.4 | Link Purpose (In Context) | The purpose of each link can be determined from the link text alone or from the link text together with its programmatically determined link context, except where the purpose of the link would be ambiguous to users in general. | A | ✅ Met | - |
| 2.4.5 | Multiple Ways | More than one way is available to locate a Web page within a set of Web pages except where the Web Page is the result of, or a step in, a process. | AA | ✅ Met | - |
| 2.4.6 | Headings and Labels | Headings and labels describe topic or purpose. | AA | ✅ Met | - |
| 2.4.7 | Focus Visible | Any keyboard operable user interface has a mode of operation where the keyboard focus indicator is visible. | AA | ✅ Met | - |
### 3. Understandable

#### 3.1 Readable

| SC | Title | Description | Level | Status | Pages |
|----|--------------|--------------------------|-------|--------|--------|
| 3.1.1 | Language of Page | The default human language of each Web page can be programmatically determined. | A | ✅ Met | - |
| 3.1.2 | Language of Parts | The human language of each passage or phrase in the content can be programmatically determined except for proper names, technical terms, words of indeterminate language, and words or phrases that have become part of the vernacular of the immediately surrounding text. | AA | ✅ Met | - |
#### 3.2 Predictable

| SC | Title | Description | Level | Status | Pages |
|----|--------------|--------------------------|-------|--------|--------|
| 3.2.1 | On Focus | When any user interface component receives focus, it does not initiate a change of context. | A | ✅ Met | - |
| 3.2.2 | On Input | Changing the setting of any user interface component does not automatically cause a change of context unless the user has been advised of the behavior before using the component. | A | ❌ Not Met | Homepage, Contact, Huurders, Application |
| 3.2.3 | Consistent Navigation | Navigational mechanisms that are repeated on multiple Web pages within a set of Web pages occur in the same relative order each time they are repeated, unless a change is initiated by the user. | AA | ✅ Met | - |
| 3.2.4 | Consistent Identification | Components that have the same functionality within a set of Web pages are identified consistently. | AA | ✅ Met | - |
#### 3.3 Input Assistance

| SC | Title | Description | Level | Status | Pages |
|----|--------------|--------------------------|-------|--------|--------|
| 3.3.1 | Error Identification | If an input error is automatically detected, the item that is in error is identified and the error is described to the user in text. | A | ✅ Met | - |
| 3.3.2 | Labels or Instructions | Labels or instructions are provided when content requires user input. | A | ✅ Met | - |
| 3.3.3 | Error Suggestion | If an input error is automatically detected and suggestions for correction are known, then the suggestions are provided to the user, unless it would jeopardize the security or purpose of the content. | AA | ✅ Met | - |
| 3.3.4 | Error Prevention (Legal, Financial, Data) | For Web pages that cause legal commitments or financial transactions for the user to occur, that modify or delete user-controllable data in data storage systems, or that submit user test responses, at least one of the following is true: | AA | ✅ Met | - |
### 4. Robust

#### 4.1 Compatible

| SC | Title | Description | Level | Status | Pages |
|----|--------------|--------------------------|-------|--------|--------|
| 4.1.1 | Parsing | In content implemented using markup languages, elements have complete start and end tags, elements are nested according to their specifications, elements do not contain duplicate attributes, and any IDs are unique, except where the specifications allow these features. | A | ✅ Met | - |
| 4.1.2 | Name, Role, Value | For all user interface components (including but not limited to: form elements, links and components generated by scripts), the name and role can be programmatically determined; states, properties, and values that can be set by the user can be programmatically set; and notification of changes to these items is available to user agents, including assistive technologies. | A | ❌ Not Met | Homepage, Contact, Huurders, Application |
