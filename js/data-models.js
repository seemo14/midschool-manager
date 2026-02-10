/**
 * data-models.js
 * Data schema definitions, ID generation, validation, and factory functions
 * for the MidSchool Management App.
 *
 * Attaches to window.MSM.Models via IIFE pattern.
 */
(function () {
    'use strict';

    // Ensure namespace exists
    window.MSM = window.MSM || {};

    // =========================================================================
    // ID Generation
    // =========================================================================

    /**
     * Generate a unique ID prefixed with the given entity type.
     * Uses crypto.randomUUID() when available, otherwise falls back to a
     * timestamp + random string combination.
     *
     * @param {string} prefix - Entity type prefix (e.g. 'stu', 'les', 'mat')
     * @returns {string} A prefixed unique identifier, e.g. "stu_a1b2c3d4"
     */
    function generateId(prefix) {
        var unique;
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            unique = crypto.randomUUID();
        } else {
            unique = Date.now().toString(36) + Math.random().toString(36).slice(2);
        }
        return prefix + '_' + unique;
    }

    // =========================================================================
    // Constants
    // =========================================================================

    var YEAR_LEVELS = [
        { value: 1, label: '1AC', grade: '7th' },
        { value: 2, label: '2AC', grade: '8th' },
        { value: 3, label: '3AC', grade: '9th' }
    ];

    var COMPLETION_STATUSES = [
        { value: 'completed',   label: 'Completed',   color: 'success' },
        { value: 'partial',     label: 'Partial',     color: 'warning' },
        { value: 'not_started', label: 'Not Started', color: 'danger' },
        { value: 'skipped',     label: 'Skipped',     color: 'neutral' }
    ];

    var MATERIAL_TYPES = [
        { value: 'textbook',   label: 'Textbook',   icon: 'book' },
        { value: 'worksheet',  label: 'Worksheet',  icon: 'file-text' },
        { value: 'digital',    label: 'Digital',    icon: 'monitor' },
        { value: 'audio',      label: 'Audio',      icon: 'headphones' },
        { value: 'video',      label: 'Video',      icon: 'play' },
        { value: 'flashcards', label: 'Flashcards', icon: 'layers' },
        { value: 'other',      label: 'Other',      icon: 'file' }
    ];

    var ASSESSMENT_CATEGORIES = [
        { value: 'written_test',  label: 'Written Test' },
        { value: 'oral_test',     label: 'Oral Test' },
        { value: 'quiz',          label: 'Quiz' },
        { value: 'homework',      label: 'Homework' },
        { value: 'project',       label: 'Project' },
        { value: 'classwork',     label: 'Classwork' },
        { value: 'participation', label: 'Participation' },
        { value: 'behavior',      label: 'Behavior' }
    ];

    var ASSESSMENT_TYPES = [
        { value: 'grade',         label: 'Grade' },
        { value: 'observation',   label: 'Observation' },
        { value: 'behavior',      label: 'Behavior' },
        { value: 'participation', label: 'Participation' },
        { value: 'attendance',    label: 'Attendance' }
    ];

    var REMEDIAL_AREAS = [
        { value: 'grammar',    label: 'Grammar' },
        { value: 'vocabulary', label: 'Vocabulary' },
        { value: 'reading',    label: 'Reading' },
        { value: 'writing',    label: 'Writing' },
        { value: 'speaking',   label: 'Speaking' },
        { value: 'listening',  label: 'Listening' },
        { value: 'general',    label: 'General' }
    ];

    var REMEDIAL_STATUSES = [
        { value: 'identified',  label: 'Identified',  color: 'danger' },
        { value: 'in_progress', label: 'In Progress', color: 'warning' },
        { value: 'improving',   label: 'Improving',   color: 'info' },
        { value: 'resolved',    label: 'Resolved',    color: 'success' }
    ];

    var EVENT_TYPES = [
        { value: 'lesson',   label: 'Lesson' },
        { value: 'exam',     label: 'Exam' },
        { value: 'holiday',  label: 'Holiday' },
        { value: 'meeting',  label: 'Meeting' },
        { value: 'event',    label: 'Event' },
        { value: 'deadline', label: 'Deadline' }
    ];

    var ACTIVITY_TYPES = [
        { value: 'presentation', label: 'Presentation' },
        { value: 'practice',     label: 'Practice' },
        { value: 'production',   label: 'Production' },
        { value: 'assessment',   label: 'Assessment' },
        { value: 'warmup',       label: 'Warm-up' },
        { value: 'cooldown',     label: 'Cool-down' }
    ];

    // Official Moroccan logbook: lesson focus/skill types
    var LESSON_FOCUS_TYPES = [
        { value: 'grammar',     label: 'Grammar' },
        { value: 'vocabulary',  label: 'Vocabulary' },
        { value: 'reading',     label: 'Reading' },
        { value: 'writing',     label: 'Writing' },
        { value: 'speaking',    label: 'Speaking' },
        { value: 'listening',   label: 'Listening' },
        { value: 'integrated',  label: 'Integrated Skills' },
        { value: 'culture',     label: 'Culture / CLIL' },
        { value: 'project',     label: 'Project Work' },
        { value: 'assessment',  label: 'Assessment / Quiz' },
        { value: 'remedial',    label: 'Remedial / Review' }
    ];

    // Official Moroccan logbook: lesson stages
    var LESSON_STAGES = [
        { value: 'warm_up',          label: 'Warm-up' },
        { value: 'review',           label: 'Review / Recall' },
        { value: 'pre_reading',      label: 'Pre-reading' },
        { value: 'while_reading',    label: 'While-reading' },
        { value: 'post_reading',     label: 'Post-reading' },
        { value: 'pre_listening',    label: 'Pre-listening' },
        { value: 'while_listening',  label: 'While-listening' },
        { value: 'post_listening',   label: 'Post-listening' },
        { value: 'rule_inferring',   label: 'Rule Inferring' },
        { value: 'checking',         label: 'Checking / CCQ' },
        { value: 'guided_practice',  label: 'Guided Practice' },
        { value: 'free_practice',    label: 'Free Practice' },
        { value: 'production',       label: 'Production' },
        { value: 'wrap_up',          label: 'Wrap-up' },
        { value: 'assessment',       label: 'Assessment' }
    ];

    // Official Moroccan logbook: cancellation/interruption reasons
    var CANCELLATION_REASONS = [
        { value: 'holiday',          label: 'Holiday' },
        { value: 'teacher_absence',  label: 'Teacher Absence' },
        { value: 'student_event',    label: 'Student Event / Trip' },
        { value: 'school_event',     label: 'School Event' },
        { value: 'exam_period',      label: 'Exam Period' },
        { value: 'weather',          label: 'Weather / Emergency' },
        { value: 'other',            label: 'Other' }
    ];

    var INTERACTION_TYPES = [
        { value: 'teacher-led',  label: 'Teacher-led' },
        { value: 'pair-work',    label: 'Pair Work' },
        { value: 'group-work',   label: 'Group Work' },
        { value: 'individual',   label: 'Individual' },
        { value: 'whole-class',  label: 'Whole Class' }
    ];

    var PLAN_STATUSES = [
        { value: 'draft',    label: 'Draft',    color: 'neutral' },
        { value: 'ready',    label: 'Ready',    color: 'info' },
        { value: 'used',     label: 'Used',     color: 'success' },
        { value: 'archived', label: 'Archived', color: 'neutral' }
    ];

    // =========================================================================
    // Helper Functions
    // =========================================================================

    /**
     * Return today's date as a "YYYY-MM-DD" string.
     * @returns {string}
     */
    function getToday() {
        var d = new Date();
        var year = d.getFullYear();
        var month = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

    /**
     * Return the year-level label for a given numeric year.
     * @param {number} yearNum - 1, 2, or 3
     * @returns {string} e.g. "1AC"
     */
    function getYearLabel(yearNum) {
        var level = YEAR_LEVELS.find(function (yl) {
            return yl.value === yearNum;
        });
        return level ? level.label : '';
    }

    /**
     * Format a score as "score/maxScore".
     * @param {number} score
     * @param {number} maxScore
     * @returns {string} e.g. "14/20"
     */
    function formatScore(score, maxScore) {
        return score + '/' + maxScore;
    }

    /**
     * Calculate the average score across an array of assessment objects.
     * Each assessment must have `score` and `maxScore` properties.
     * Returns the average as a percentage of maxScore, rounded to 1 decimal.
     *
     * @param {Array} assessments
     * @returns {number} Average percentage rounded to one decimal place, or 0 if empty.
     */
    function calculateAverage(assessments) {
        if (!assessments || assessments.length === 0) {
            return 0;
        }

        var validAssessments = assessments.filter(function (a) {
            return (
                typeof a.score === 'number' &&
                typeof a.maxScore === 'number' &&
                a.maxScore > 0
            );
        });

        if (validAssessments.length === 0) {
            return 0;
        }

        var totalPercentage = validAssessments.reduce(function (sum, a) {
            return sum + (a.score / a.maxScore) * 100;
        }, 0);

        return Math.round((totalPercentage / validAssessments.length) * 10) / 10;
    }

    /**
     * Determine the current semester (1 or 2) based on the current date and
     * the semester boundary dates stored in settings.
     *
     * @param {Object} settings - Should contain semester2Start as a "YYYY-MM-DD" string.
     * @returns {number} 1 or 2
     */
    function getCurrentSemester(settings) {
        var today = getToday();

        if (settings && settings.semester2Start && today >= settings.semester2Start) {
            return 2;
        }

        return 1;
    }

    // =========================================================================
    // Internal utility: shallow merge with defaults
    // =========================================================================

    function merge(defaults, data) {
        var result = {};
        var key;
        for (key in defaults) {
            if (defaults.hasOwnProperty(key)) {
                result[key] = defaults[key];
            }
        }
        if (data) {
            for (key in data) {
                if (data.hasOwnProperty(key)) {
                    result[key] = data[key];
                }
            }
        }
        return result;
    }

    // =========================================================================
    // Factory Functions
    // =========================================================================

    /**
     * Create a new Student object.
     * @param {Object} data - Must include firstName, lastName, classId.
     *                        Optional: fullNameAr, studentNumber, gender, notes
     * @returns {Object}
     */
    function createStudent(data) {
        var now = new Date().toISOString();
        var defaults = {
            id: generateId('stu'),
            firstName: '',
            lastName: '',
            fullNameAr: '',
            classId: '',
            studentNumber: '',
            gender: '',
            notes: '',
            createdAt: now,
            updatedAt: now
        };
        return merge(defaults, data);
    }

    /**
     * Create a new Lesson Record object.
     * @param {Object} data - Must include classId, date.
     *                        Optional: period, unit, topic, textbookPage,
     *                        activities, homework, completionStatus, notes,
     *                        lessonFocus, lessonStages, studentActivities,
     *                        cancellationReason, cancellationNote
     * @returns {Object}
     */
    function createLessonRecord(data) {
        var now = new Date().toISOString();
        var defaults = {
            id: generateId('les'),
            classId: '',
            date: '',
            period: '',
            unit: '',
            topic: '',
            textbookPage: '',
            lessonFocus: '',
            lessonStages: [],
            studentActivities: '',
            activities: '',
            homework: '',
            completionStatus: 'completed',
            cancellationReason: '',
            cancellationNote: '',
            notes: '',
            createdAt: now,
            updatedAt: now
        };
        return merge(defaults, data);
    }

    /**
     * Create a new Material object.
     * @param {Object} data - Must include title, type.
     *                        Optional: yearLevel, unit, lesson, description,
     *                        source, fileReference, isAvailable, notes, tags
     * @returns {Object}
     */
    function createMaterial(data) {
        var now = new Date().toISOString();
        var defaults = {
            id: generateId('mat'),
            title: '',
            type: '',
            yearLevel: '',
            unit: '',
            lesson: '',
            description: '',
            source: '',
            fileReference: '',
            isAvailable: true,
            notes: '',
            tags: [],
            createdAt: now,
            updatedAt: now
        };
        return merge(defaults, data);
    }

    /**
     * Create a new Lesson Plan object.
     * @param {Object} data - Must include title, yearLevel.
     *                        Optional: unit, lesson, duration, objectives,
     *                        materials, warmUp, activities, assessment,
     *                        homework, differentiation, notes, status
     * @returns {Object}
     */
    function createLessonPlan(data) {
        var now = new Date().toISOString();
        var defaults = {
            id: generateId('pln'),
            title: '',
            yearLevel: '',
            unit: '',
            lesson: '',
            duration: 55,
            objectives: [],
            materials: [],
            warmUp: { activity: '', duration: 5 },
            activities: [],
            assessment: '',
            homework: '',
            differentiation: '',
            notes: '',
            status: 'draft',
            createdAt: now,
            updatedAt: now
        };
        return merge(defaults, data);
    }

    /**
     * Create a new Calendar Event object.
     * @param {Object} data - Must include title, type, date.
     *                        Optional: classId, lessonPlanId, startTime,
     *                        endTime, isRecurring, recurrenceRule, color, notes
     * @returns {Object}
     */
    function createCalendarEvent(data) {
        var now = new Date().toISOString();
        var defaults = {
            id: generateId('evt'),
            title: '',
            type: '',
            date: '',
            classId: '',
            lessonPlanId: '',
            startTime: '',
            endTime: '',
            isRecurring: false,
            recurrenceRule: '',
            color: '',
            notes: '',
            createdAt: now,
            updatedAt: now
        };
        return merge(defaults, data);
    }

    /**
     * Create a new Assessment object.
     * @param {Object} data - Must include studentId, classId, type, category.
     *                        Optional: title, date, score, maxScore, notes, semester
     * @returns {Object}
     */
    function createAssessment(data) {
        var now = new Date().toISOString();
        var defaults = {
            id: generateId('asr'),
            studentId: '',
            classId: '',
            type: '',
            category: '',
            title: '',
            date: getToday(),
            score: null,
            maxScore: 20,
            notes: '',
            semester: 1,
            createdAt: now,
            updatedAt: now
        };
        return merge(defaults, data);
    }

    /**
     * Create a new Remedial tracking object.
     * @param {Object} data - Must include studentId, classId, area.
     *                        Optional: identifiedDate, specificIssue,
     *                        interventionPlan, interventions, status,
     *                        resolvedDate, notes
     * @returns {Object}
     */
    function createRemedial(data) {
        var now = new Date().toISOString();
        var defaults = {
            id: generateId('rem'),
            studentId: '',
            classId: '',
            area: '',
            identifiedDate: getToday(),
            specificIssue: '',
            interventionPlan: '',
            interventions: [],
            status: 'identified',
            resolvedDate: '',
            notes: '',
            createdAt: now,
            updatedAt: now
        };
        return merge(defaults, data);
    }

    // =========================================================================
    // Validation Functions
    // =========================================================================

    /**
     * Validate a student object.
     * @param {Object} obj
     * @returns {{ valid: boolean, errors: string[] }}
     */
    function validateStudent(obj) {
        var errors = [];

        if (!obj.firstName || typeof obj.firstName !== 'string' || obj.firstName.trim() === '') {
            errors.push('First name is required and must be a non-empty string.');
        }

        if (!obj.lastName || typeof obj.lastName !== 'string' || obj.lastName.trim() === '') {
            errors.push('Last name is required and must be a non-empty string.');
        }

        if (!obj.classId) {
            errors.push('Class ID is required.');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validate a lesson record object.
     * @param {Object} obj
     * @returns {{ valid: boolean, errors: string[] }}
     */
    function validateLessonRecord(obj) {
        var errors = [];

        if (!obj.classId) {
            errors.push('Class ID is required.');
        }

        if (!obj.date) {
            errors.push('Date is required.');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validate an assessment object.
     * @param {Object} obj
     * @returns {{ valid: boolean, errors: string[] }}
     */
    function validateAssessment(obj) {
        var errors = [];

        if (!obj.studentId) {
            errors.push('Student ID is required.');
        }

        if (!obj.classId) {
            errors.push('Class ID is required.');
        }

        if (obj.score !== null && obj.score !== undefined) {
            if (typeof obj.score !== 'number' || obj.score < 0) {
                errors.push('Score must be a number greater than or equal to 0.');
            }

            var max = (typeof obj.maxScore === 'number') ? obj.maxScore : 20;
            if (typeof obj.score === 'number' && obj.score > max) {
                errors.push('Score must not exceed the maximum score (' + max + ').');
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    // =========================================================================
    // Public API
    // =========================================================================

    window.MSM.Models = {
        // ID generation
        generateId: generateId,

        // Constants
        YEAR_LEVELS: YEAR_LEVELS,
        COMPLETION_STATUSES: COMPLETION_STATUSES,
        MATERIAL_TYPES: MATERIAL_TYPES,
        ASSESSMENT_CATEGORIES: ASSESSMENT_CATEGORIES,
        ASSESSMENT_TYPES: ASSESSMENT_TYPES,
        REMEDIAL_AREAS: REMEDIAL_AREAS,
        REMEDIAL_STATUSES: REMEDIAL_STATUSES,
        EVENT_TYPES: EVENT_TYPES,
        ACTIVITY_TYPES: ACTIVITY_TYPES,
        LESSON_FOCUS_TYPES: LESSON_FOCUS_TYPES,
        LESSON_STAGES: LESSON_STAGES,
        CANCELLATION_REASONS: CANCELLATION_REASONS,
        INTERACTION_TYPES: INTERACTION_TYPES,
        PLAN_STATUSES: PLAN_STATUSES,

        // Factory functions
        createStudent: createStudent,
        createLessonRecord: createLessonRecord,
        createMaterial: createMaterial,
        createLessonPlan: createLessonPlan,
        createCalendarEvent: createCalendarEvent,
        createAssessment: createAssessment,
        createRemedial: createRemedial,

        // Validation functions
        validateStudent: validateStudent,
        validateLessonRecord: validateLessonRecord,
        validateAssessment: validateAssessment,

        // Helper functions
        getYearLabel: getYearLabel,
        formatScore: formatScore,
        calculateAverage: calculateAverage,
        getToday: getToday,
        getCurrentSemester: getCurrentSemester
    };
})();
