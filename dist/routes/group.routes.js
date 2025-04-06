const express = require('express');
const {
  createGroup,
  getGroupDetails,
  updateGroup,
  addMember,
  removeMember,
  promoteMember,
  demoteLeader,
  joinGroup,
  regenerateInviteCode,
  getLeaderboard,
  listUserGroups
} = require('../controllers/group.controller');
const {
  authenticate
} = require('../middleware/auth.middleware');
const {
  isGroupLeader,
  isGroupMember
} = require('../middleware/role.middleware');
const {
  validate,
  createGroupSchema
} = require('../utils/validators');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @route POST /api/groups
 * @desc Create a new group
 * @access Private
 */
router.post('/', validate(createGroupSchema), createGroup);

/**
 * @route GET /api/groups
 * @desc List user's groups
 * @access Private
 */
router.get('/', listUserGroups);

/**
 * @route GET /api/groups/:groupId
 * @desc Get group details
 * @access Private
 */
router.get('/:groupId', getGroupDetails);

/**
 * @route PATCH /api/groups/:groupId
 * @desc Update group details
 * @access Private (Group Leaders only)
 */
router.patch('/:groupId', isGroupLeader, updateGroup);

/**
 * @route POST /api/groups/:groupId/members
 * @desc Add a member to a group
 * @access Private (Group Leaders only)
 */
router.post('/:groupId/members', isGroupLeader, addMember);

/**
 * @route DELETE /api/groups/:groupId/members/:memberId
 * @desc Remove a member from a group
 * @access Private (Group Leaders or Self)
 */
router.delete('/:groupId/members/:memberId', removeMember);

/**
 * @route POST /api/groups/:groupId/members/:memberId/promote
 * @desc Promote a member to leader
 * @access Private (Group Leaders only)
 */
router.post('/:groupId/members/:memberId/promote', isGroupLeader, promoteMember);

/**
 * @route POST /api/groups/:groupId/leaders/:leaderId/demote
 * @desc Demote a leader to member
 * @access Private (Group Leaders only)
 */
router.post('/:groupId/leaders/:leaderId/demote', isGroupLeader, demoteLeader);

/**
 * @route POST /api/groups/join
 * @desc Join a group using invite code
 * @access Private
 */
router.post('/join', joinGroup);

/**
 * @route POST /api/groups/:groupId/invite
 * @desc Regenerate invite code
 * @access Private (Group Leaders only)
 */
router.post('/:groupId/invite', isGroupLeader, regenerateInviteCode);

/**
 * @route GET /api/groups/:groupId/leaderboard
 * @desc Get group leaderboard
 * @access Private (Group Members, Leaders, or Public)
 */
router.get('/:groupId/leaderboard', getLeaderboard);
module.exports = router;