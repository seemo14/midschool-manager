/**
 * MidSchool Manager - AI Service Module
 * Handles communication with Google Gemini API for intelligent features:
 * - Lesson plan → logbook extraction
 * - Smart suggestions
 *
 * Depends on: MSM.Storage (for API key from settings)
 */
(function () {
  'use strict';

  window.MSM = window.MSM || {};

  var BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

  /**
   * Get the API key and model from settings
   */
  function getConfig() {
    var settings = MSM.Storage.getData('msm_settings') || {};
    return {
      apiKey: settings.aiApiKey || '',
      model: settings.aiModel || 'gemini-2.5-flash'
    };
  }

  /**
   * Call Gemini API with a prompt
   * @param {string} prompt - The text prompt
   * @param {object} [options] - Optional overrides { temperature, maxTokens }
   * @returns {Promise<string>} The generated text response
   */
  function callGemini(prompt, options) {
    options = options || {};
    var config = getConfig();

    if (!config.apiKey) {
      return Promise.reject(new Error('No API key configured. Go to Settings → AI Integration to add your Gemini API key.'));
    }

    var url = BASE_URL + config.model + ':generateContent?key=' + config.apiKey;

    var body = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: options.temperature !== undefined ? options.temperature : 0.3,
        maxOutputTokens: options.maxTokens || 4096,
        responseMimeType: 'application/json'
      }
    };

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          var msg = (err.error && err.error.message) ? err.error.message : 'HTTP ' + res.status;
          // Detect quota errors and suggest switching models
          if (res.status === 429 || (msg && msg.toLowerCase().indexOf('quota') >= 0)) {
            msg = 'Quota exceeded for model "' + config.model + '". Try switching to a different model in Settings (e.g. gemini-2.5-flash) or wait a few minutes.';
          }
          throw new Error(msg);
        });
      }
      return res.json();
    })
    .then(function (data) {
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        return data.candidates[0].content.parts[0].text;
      }
      throw new Error('Unexpected API response format');
    });
  }

  /**
   * Extract logbook entries from a lesson plan.
   * Takes a lesson plan object and the list of classes for the year level,
   * returns structured logbook entries ready to review.
   *
   * @param {object} plan - The lesson plan object
   * @param {object[]} classes - Array of class objects for this plan's year level
   * @returns {Promise<object[]>} Array of logbook entry objects
   */
  function extractLogbook(plan, classes) {
    var classNames = classes.map(function (c) { return c.name; }).join(', ');
    var yearLabels = ['', '1AC (7th grade)', '2AC (8th grade)', '3AC (9th grade)'];

    // Build a rich description of the plan
    var planDescription = 'Title: ' + (plan.title || 'Untitled') + '\n';
    planDescription += 'Year Level: ' + yearLabels[plan.yearLevel || 1] + '\n';
    planDescription += 'Unit: ' + (plan.unit || 'N/A') + '\n';
    planDescription += 'Lesson: ' + (plan.lesson || 'N/A') + '\n';
    planDescription += 'Duration: ' + (plan.duration || 55) + ' minutes\n';

    if (plan.objectives && plan.objectives.length > 0) {
      planDescription += 'Objectives:\n';
      plan.objectives.forEach(function (o) { planDescription += '  - ' + o + '\n'; });
    }

    if (plan.warmUp && plan.warmUp.activity) {
      planDescription += 'Warm-Up: ' + plan.warmUp.activity + ' (' + (plan.warmUp.duration || 5) + ' min)\n';
    }

    if (plan.activities && plan.activities.length > 0) {
      planDescription += 'Activities:\n';
      plan.activities.forEach(function (a, i) {
        planDescription += '  ' + (i + 1) + '. ' + a.title + ' (' + a.type + ', ' + (a.duration || 10) + ' min)\n';
      });
    }

    if (plan.assessment) planDescription += 'Assessment: ' + plan.assessment + '\n';
    if (plan.homework) planDescription += 'Homework: ' + plan.homework + '\n';
    if (plan.differentiation) planDescription += 'Differentiation: ' + plan.differentiation + '\n';
    if (plan.notes) planDescription += 'Notes: ' + plan.notes + '\n';

    var stageValues = 'warm_up, review, pre_reading, while_reading, post_reading, pre_listening, while_listening, post_listening, rule_inferring, checking, guided_practice, free_practice, production, wrap_up, assessment';
    var focusValues = 'grammar, vocabulary, reading, writing, speaking, listening, integrated, culture, project, assessment, remedial';

    var prompt = 'You are an assistant for a Moroccan English teacher in collège (middle school). ' +
      'Given this lesson plan, extract concise logbook entries for each class following the official Moroccan teacher logbook format.\n\n' +
      'The classes at this year level are: ' + classNames + '\n\n' +
      'LESSON PLAN:\n' + planDescription + '\n\n' +
      'Generate a JSON array of logbook entries. Each entry should have:\n' +
      '- "className": the class name (e.g. "1AC-1")\n' +
      '- "topic": a concise topic title (max 60 chars)\n' +
      '- "unit": the unit name from the plan\n' +
      '- "lessonFocus": one of [' + focusValues + '] — the primary skill/focus of this lesson\n' +
      '- "lessonStages": array of stages used, from [' + stageValues + '] — in order they occur\n' +
      '- "studentActivities": describe what STUDENTS do using Bloom\'s taxonomy action verbs (identify, match, classify, compare, produce, create, evaluate, etc.)\n' +
      '- "activities": a brief summary of what was done in class (1-2 sentences)\n' +
      '- "homework": homework assigned (if any, otherwise empty string)\n' +
      '- "notes": any relevant notes (can be empty)\n' +
      '- "completionStatus": "completed" (default, teacher can change later)\n\n' +
      'Create one entry per class. The activities summary should be a natural, teacher-friendly description ' +
      'of what happened during the lesson, derived from the plan activities.\n' +
      'For lessonStages, infer from the plan (e.g. reading plan → pre_reading, while_reading, post_reading).\n' +
      'Keep it practical and realistic - this is for the official Moroccan teacher logbook.\n\n' +
      'Return ONLY the JSON array, no other text.';

    return callGemini(prompt, { temperature: 0.2 })
      .then(function (responseText) {
        // Parse the JSON response
        var text = responseText.trim();
        // Handle possible markdown code blocks
        if (text.indexOf('```') >= 0) {
          text = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '');
        }
        var entries = JSON.parse(text);
        if (!Array.isArray(entries)) {
          throw new Error('Expected an array of logbook entries');
        }
        return entries;
      });
  }

  /**
   * Generate smart suggestions for a lesson plan based on existing records
   *
   * @param {object} plan - Partial plan data
   * @param {object[]} existingPlans - Previously created plans for context
   * @returns {Promise<object>} Suggested content
   */
  function suggestPlanContent(plan, existingPlans) {
    var context = '';
    if (existingPlans && existingPlans.length > 0) {
      var recent = existingPlans.slice(0, 3);
      context = '\n\nRecent plans for reference:\n';
      recent.forEach(function (p) {
        context += '- ' + p.title + ' (Unit: ' + (p.unit || 'N/A') + ')\n';
      });
    }

    var prompt = 'You are helping a Moroccan English teacher create a lesson plan for collège students. ' +
      'Year level: ' + (['', '1AC (7th grade)', '2AC (8th grade)', '3AC (9th grade)'][plan.yearLevel || 1]) + '\n' +
      'Title: ' + (plan.title || 'Unknown') + '\n' +
      'Unit: ' + (plan.unit || 'Unknown') + '\n' +
      context + '\n\n' +
      'Suggest the following as a JSON object:\n' +
      '- "objectives": array of 2-3 learning objectives (starting with "Students will be able to...")\n' +
      '- "warmUp": a brief warm-up activity idea (string)\n' +
      '- "activities": array of 3-4 activity objects, each with "title", "type" (presentation/practice/production/assessment), and "duration" (in minutes)\n' +
      '- "assessment": a brief assessment idea\n' +
      '- "homework": a homework suggestion\n\n' +
      'Keep suggestions practical for Moroccan middle school context. Total activities should fit within 55 minutes.\n' +
      'Return ONLY the JSON object.';

    return callGemini(prompt, { temperature: 0.5 })
      .then(function (responseText) {
        var text = responseText.trim();
        if (text.indexOf('```') >= 0) {
          text = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '');
        }
        return JSON.parse(text);
      });
  }

  /**
   * AI-powered suggestions for lesson record content (official logbook format).
   * Suggests activities, homework, stages, and student activities based on
   * the lesson focus, unit, topic, and recent lesson history.
   *
   * @param {object} lessonData - Partial lesson data { classId, unit, topic, lessonFocus, period, textbookPage }
   * @param {object[]} recentLessons - Last 3 lessons for this class (for continuity)
   * @returns {Promise<object>} { activities, homework, studentActivities, lessonStages, notes }
   */
  function suggestLessonContent(lessonData, recentLessons) {
    var yearLabels = ['', '1AC (7th grade)', '2AC (8th grade)', '3AC (9th grade)'];
    var className = '';
    if (lessonData.classId && window.MSM.Storage) {
      var cls = MSM.Storage.getById(MSM.Storage.STORAGE_KEYS.CLASSES, lessonData.classId);
      if (cls) className = cls.name;
    }

    var recentContext = '';
    if (recentLessons && recentLessons.length > 0) {
      recentContext = '\n\nRecent lessons for this class (for continuity):\n';
      recentLessons.forEach(function (l) {
        recentContext += '- ' + (l.date || '') + ': ' + (l.topic || 'N/A') + ' (Focus: ' + (l.lessonFocus || 'N/A') + ')\n';
      });
    }

    var stageValues = 'warm_up, review, pre_reading, while_reading, post_reading, pre_listening, while_listening, post_listening, rule_inferring, checking, guided_practice, free_practice, production, wrap_up, assessment';
    var focusValues = 'grammar, vocabulary, reading, writing, speaking, listening, integrated, culture, project, assessment, remedial';

    var prompt = 'You are helping a Moroccan English teacher fill in the official logbook for collège (middle school).\n' +
      'Class: ' + (className || 'Unknown') + '\n' +
      'Unit: ' + (lessonData.unit || 'Unknown') + '\n' +
      'Topic: ' + (lessonData.topic || 'Unknown') + '\n' +
      'Lesson Focus: ' + (lessonData.lessonFocus || 'Not specified') + '\n' +
      'Textbook Page: ' + (lessonData.textbookPage || 'N/A') + '\n' +
      recentContext + '\n\n' +
      'Based on the official Moroccan teacher logbook format, suggest:\n' +
      '- "activities": a practical description of lesson activities (2-3 sentences)\n' +
      '- "homework": a relevant homework assignment (1 sentence, or empty string if none)\n' +
      '- "studentActivities": describe what STUDENTS do using Bloom\'s taxonomy action verbs. ' +
      'Use verbs like: identify, match, classify, compare, order, complete, produce, create, evaluate, analyze, ' +
      'underline, circle, fill in, listen and repeat, read aloud, role-play, write, rewrite, correct. ' +
      'Format as a comma-separated list of activities (e.g. "Ss identify new vocabulary, Ss match words to definitions, Ss produce sentences")\n' +
      '- "lessonStages": array of stage values from [' + stageValues + '] that apply to this lesson focus, in the correct pedagogical order\n' +
      '- "notes": any brief pedagogical note (can be empty)\n\n' +
      'For lessonFocus "' + (lessonData.lessonFocus || 'integrated') + '", pick the most appropriate stages.\n' +
      'Examples: reading → [warm_up, pre_reading, while_reading, post_reading, wrap_up]; ' +
      'grammar → [warm_up, review, rule_inferring, checking, guided_practice, free_practice, wrap_up]; ' +
      'listening → [warm_up, pre_listening, while_listening, post_listening, production, wrap_up].\n\n' +
      'Return ONLY the JSON object.';

    return callGemini(prompt, { temperature: 0.4 })
      .then(function (responseText) {
        var text = responseText.trim();
        if (text.indexOf('```') >= 0) {
          text = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '');
        }
        return JSON.parse(text);
      });
  }

  /**
   * AI-powered suggestions for material descriptions and tags.
   *
   * @param {object} materialData - Partial material data { title, type, yearLevel, unit, lesson }
   * @returns {Promise<object>} { description, tags, notes, lesson }
   */
  function suggestMaterialContent(materialData) {
    var yearLabels = ['All Levels', '1AC (7th grade)', '2AC (8th grade)', '3AC (9th grade)'];

    var prompt = 'You are helping a Moroccan English teacher catalog a teaching material for collège (middle school).\n' +
      'Material Title: ' + (materialData.title || 'Unknown') + '\n' +
      'Type: ' + (materialData.type || 'Unknown') + '\n' +
      'Year Level: ' + yearLabels[materialData.yearLevel || 0] + '\n' +
      'Unit: ' + (materialData.unit || 'Not specified') + '\n' +
      'Lesson: ' + (materialData.lesson || 'Not specified') + '\n\n' +
      'Suggest the following as a JSON object:\n' +
      '- "description": a brief, practical description of the material (1-2 sentences)\n' +
      '- "tags": array of 3-5 relevant tags (lowercase, e.g. ["vocabulary", "unit 3", "worksheet"])\n' +
      '- "notes": any usage notes for the teacher (1 sentence, can be empty string)\n' +
      '- "lesson": if not provided, suggest which lesson this material fits (e.g. "Lesson 2"), or empty string\n\n' +
      'Keep it practical for Moroccan middle school English teaching context.\n' +
      'Return ONLY the JSON object.';

    return callGemini(prompt, { temperature: 0.4 })
      .then(function (responseText) {
        var text = responseText.trim();
        if (text.indexOf('```') >= 0) {
          text = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '');
        }
        return JSON.parse(text);
      });
  }

  // =====================================================================
  // Public API
  // =====================================================================
  window.MSM.AI = {
    getConfig: getConfig,
    callGemini: callGemini,
    extractLogbook: extractLogbook,
    suggestPlanContent: suggestPlanContent,
    suggestLessonContent: suggestLessonContent,
    suggestMaterialContent: suggestMaterialContent
  };

})();
